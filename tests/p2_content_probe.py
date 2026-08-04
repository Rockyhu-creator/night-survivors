"""v4.0 P2 数据驱动内容扩充 · 统一探针（合并 p2_probe + p2_content_probe）

驱动运行中的真实游戏（?debug + 手动泵 g.enemies.update，冻结 rAF 步进），
覆盖 P2 交付 + P2 收尾：
  · 6 新小怪 + revenant_shard 数据结构与字段齐全
  · 5 新词缀 minTime 分时段 + shielded.minTime=60 + bone_knight.affixBan
  · 3 新 Boss 数据 + 仅用现有 6 skill type + Boss 串行化（全部进 bossSpawned）
  · 词缀 minTime 门控（t=10 不投新词缀，逐级解锁）
  · 【P2 收尾】lateWeight 接入 pickType：t>=NIGHT_START(540) 用 lateWeight，
    抬高 bat/slime/rat_swarm 绝对量，防后期支柱漂移（保住割草 Roguelite 手感）
  · P1 尾：threatTierName 难度感知（normal 封顶永夜，hard 可达终焉）
  · 运行到 t=600s 新怪/新词缀渲染全程无报错

判据来源：docs/plans/2026-08-04-difficulty-content-expansion.md §2.4/§2.5/§4/§5。
"""
import os
import sys
from playwright.sync_api import sync_playwright

# 默认连标准 5173；可用环境变量 P2_PROBE_PORT 或命令行参数覆盖
# （P2 开发期 vite 顺延到 5174 时：P2_PROBE_PORT=5174 python tests/p2_content_probe.py）
PORT = int(os.environ.get('P2_PROBE_PORT', sys.argv[1] if len(sys.argv) > 1 else 5173))
URL = f'http://localhost:{PORT}/?debug'

fails = []


def expect(name, cond, detail=''):
    print(f"{'PASS' if cond else 'FAIL'} {name}{('  ' + detail) if detail else ''}")
    if not cond:
        fails.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function("() => window.__game && window.__game.state !== 'loading'", timeout=20000)
    page.evaluate("() => window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[],tree:[]})")

    # ---------- 1. 数据结构断言（直接读真实模块）----------
    print("\n=== 1. 数据结构（ENEMY_TYPES / AFFIXES / BOSSES）===")
    data = page.evaluate("""() => {
      const m = window.__enemyTypes, b = window.__bosses;
      return {
        enemyKeys: Object.keys(m),
        bossIds: b.map(x => x.id),
        bosses: b.map(x => ({id:x.id, unlockAt:x.unlockAt,
          skills:(x.skills||[]).map(s=>s.type)})),
      };
    }""")
    affix = page.evaluate("""async () => {
      const m = await import('/src/data.js');
      return Object.fromEntries(Object.entries(m.AFFIXES).map(([k,v]) => [k,
        {minTime: v.minTime ?? 0, expMul: v.expMul, color: v.color}]));
    }""")

    NEW_ENEMIES = ['rat_swarm', 'spitter', 'bone_knight', 'plague_bearer', 'siren', 'revenant', 'revenant_shard']
    for k in NEW_ENEMIES:
        expect(f'ENEMY_TYPES 含 {k}', k in data['enemyKeys'], str(data['enemyKeys']))
    shard = page.evaluate("() => window.__enemyTypes.revenant_shard")
    expect('revenant_shard.weight === 0（不进刷怪池）', shard and shard.get('weight') == 0, str(shard))
    for k in NEW_ENEMIES[:-1]:
        e = page.evaluate(f"() => window.__enemyTypes['{k}']")
        ok = e and all(f in e for f in ('id', 'unlockAt', 'weight', 'exp', 'hp', 'speed', 'damage'))
        expect(f'{k} 字段齐全(id/unlockAt/weight/exp/hp/spd/dmg)', ok, str(e))

    NEW_AFFIXES = ['swift', 'regen', 'leech', 'bulwark', 'frost']
    for k in NEW_AFFIXES:
        expect(f'AFFIXES 含 {k}', k in affix, '')
    expect('swift.minTime === 30', affix.get('swift', {}).get('minTime') == 30)
    expect('regen.minTime === 150', affix.get('regen', {}).get('minTime') == 150)
    expect('leech.minTime === 210', affix.get('leech', {}).get('minTime') == 210)
    expect('bulwark.minTime === 300', affix.get('bulwark', {}).get('minTime') == 300)
    expect('frost.minTime === 240', affix.get('frost', {}).get('minTime') == 240)
    expect('shielded.minTime === 60（design §5.2）', affix.get('shielded', {}).get('minTime') == 60)
    bk = page.evaluate("() => window.__enemyTypes.bone_knight")
    expect("bone_knight.affixBan 含 'bulwark'", bk and 'bulwark' in (bk.get('affixBan') or []), str(bk))

    NEW_BOSSES = ['herald', 'alchemist', 'warlord']
    for k in NEW_BOSSES:
        expect(f'BOSSES 含 {k}', k in data['bossIds'], str(data['bossIds']))
    boss_map = {x['id']: x for x in data['bosses']}
    expect('herald.unlockAt === 90', boss_map['herald']['unlockAt'] == 90)
    expect('alchemist.unlockAt === 270', boss_map['alchemist']['unlockAt'] == 270)
    expect('warlord.unlockAt === 450', boss_map['warlord']['unlockAt'] == 450)
    ALLOWED = {'summon', 'barrage', 'dash', 'summon_barrage', 'dash_barrage', 'enrage'}
    for k in NEW_BOSSES:
        bad = [s for s in boss_map[k]['skills'] if s not in ALLOWED]
        expect(f'{k} 仅用现有 6 种 skill type', not bad, str(bad))

    # ---------- 2. 启动 run 并冻结 rAF 步进，手动泵 spawn ----------
    print("\n=== 2. 真实 spawn 调度（手动泵 g.enemies.update）===")
    page.evaluate("""() => {
      const g = window.__game;
      g.setDifficulty('normal');
      g.startRun();
      g.state = 'paused';           // 冻结主循环，手动泵 update
    }""")

    # 2a. 新怪进入刷怪池（pickType 实际抽到）
    print("--- 2a. 新怪按 unlockAt 进入刷怪池 ---")
    milestones = [
        (20, 'rat_swarm'), (75, 'spitter'), (200, 'bone_knight'),
        (260, 'plague_bearer'), (320, 'siren'), (400, 'revenant'),
    ]
    for t, eid in milestones:
        seen = page.evaluate(f"""() => {{
          const g = window.__game; g.time = {t};
          const seen = new Set();
          for (let i = 0; i < 400; i++) seen.add(g.enemies.pickType().id);
          return [...seen];
        }}""")
        expect(f't={t}s 刷怪池含 {eid}', eid in seen, str(seen))

    # 2b. Boss 串行化：逐时点驱动，击杀当前 Boss 释放队列，验证 3 新 Boss 都被调度
    print("--- 2b. Boss 串行化（herald→alchemist→warlord 均进 bossSpawned）---")
    seen_spawned = set()
    for t in (90, 180, 270, 360, 450, 540, 600):
        r = page.evaluate(f"""() => {{
          const g = window.__game;
          g.time = {t};
          g.player.hp = g.player.maxHp = 1e9;           // 保活，避免误判 gameover
          const e = g.enemies.activeBoss;
          if (e) e.hp = 0;                              // 模拟击杀当前 Boss → 触发串行化释放
          g.enemies.update(0.05);
          return {{ active: g.enemies.activeBoss && g.enemies.activeBoss.type.id,
                   spawned: [...g.enemies.bossSpawned],
                   pending: g.enemies.pendingBosses.map(d => d.id) }};
        }}""")
        seen_spawned.update(r['spawned'])
        print(f"  t={t:>3}s active={str(r['active']):<10} pending={r['pending']} spawned={r['spawned']}")
    for k in NEW_BOSSES:
        expect(f'{k} 已被调度（bossSpawned 含该 id）', k in seen_spawned, str(sorted(seen_spawned)))

    # 2c. 词缀分时段：真实 rollSingleAffix 采样（minTime 门控 + 逐级解锁）
    print("--- 2c. 词缀 minTime 门控（t=10 不投新词缀，逐级解锁）---")
    sample = page.evaluate("""() => {
      const g = window.__game; g.state = 'paused';
      const run = (t, n) => {
        const before = g.time; g.time = t;
        const seen = new Set();
        for (let i = 0; i < n; i++) { const a = g.enemies.rollSingleAffix(g.enemies.pickType()); if (a) seen.add(a); }
        g.time = before;
        return [...seen];
      };
      return {
        t10: run(10, 9000), t100: run(100, 9000), t160: run(160, 9000),
        t220: run(220, 9000), t250: run(250, 9000), t310: run(310, 9000),
      };
    }""")
    new5 = ['swift', 'regen', 'leech', 'bulwark', 'frost']
    early_leak = [a for a in new5 if a in sample['t10']]
    expect('t=10 新词缀未过早掉落（minTime 门控）', not early_leak, f"泄漏 {early_leak}" if early_leak else "ok")
    expect('t=100 出现 swift(min30) 且无 regen/leech/bulwark/frost',
           'swift' in sample['t100'] and not any(a in sample['t100'] for a in ['regen', 'leech', 'bulwark', 'frost']))
    expect('t=160 出现 regen(min150) 且无 leech/bulwark/frost',
           'regen' in sample['t160'] and not any(a in sample['t160'] for a in ['leech', 'bulwark', 'frost']))
    expect('t=220 出现 leech(min210) 且无 bulwark/frost',
           'leech' in sample['t220'] and not any(a in sample['t220'] for a in ['bulwark', 'frost']))
    expect('t=250 出现 frost(min240) 且无 bulwark',
           'frost' in sample['t250'] and 'bulwark' not in sample['t250'])
    expect('t=310 出现 bulwark(min300)', 'bulwark' in sample['t310'])
    expect('rollSingleAffix 排除 pack 且 t=10 仅得 volatile',
           all(a == 'volatile' for a in sample['t10']) and 'volatile' in sample['t10'], f"t10={sample['t10']}")

    # 2d. 【P2 收尾】lateWeight 接入 pickType：t>=NIGHT_START(540) 用 lateWeight
    print("--- 2d. lateWeight 接入 pickType 防后期支柱漂移 ---")
    lw = page.evaluate("""() => {
      const g = window.__game; g.state = 'paused';
      const T = {bat:3, slime:1, rat_swarm:3};           // 裸 weight
      const L = {bat:4, slime:2, rat_swarm:4};           // lateWeight（data 层设定）
      const et = window.__enemyTypes;
      const dataOk = et.bat.lateWeight===4 && et.slime.lateWeight===2 && et.rat_swarm.lateWeight===4;
      const trashBare = T.bat + T.slime + T.rat_swarm;   // 7
      const trashLate = L.bat + L.slime + L.rat_swarm;   // 10
      // 期望值必须按“与观测同一时点”的刷怪池计算（解锁集不同→分母不同）
      const expAt = (t) => {
        const pool = Object.values(et).filter(e => e.weight>0 && t >= e.unlockAt);
        const bareTotal = pool.reduce((s,e)=>s+e.weight,0);
        const lateTotal = pool.reduce((s,e)=>s+(e.lateWeight ?? e.weight),0);
        return { bareExp: trashBare/bareTotal, lateExp: trashLate/lateTotal };
      };
      // 行为采样：t=300（裸）与 t=600（晚）各抽 8000 次，统计杂兵合计占比
      const share = (t, n) => {
        g.time = t; let c = 0;
        for (let i=0;i<n;i++){ const id=g.enemies.pickType().id; if (id==='bat'||id==='slime'||id==='rat_swarm') c++; }
        return c/n;
      };
      const e300 = expAt(300), e600 = expAt(600);
      return {
        dataOk,
        bareExp300: e300.bareExp, lateExp300: e300.lateExp,
        bareExp600: e600.bareExp, lateExp600: e600.lateExp,
        obs300: share(300,8000), obs600: share(600,8000),
      };
    }""")
    expect('数据层 lateWeight 已设（bat=4/slime=2/rat_swarm=4）', lw['dataOk'])
    expect('t<540 用裸 weight（300s 杂兵占比≈裸期望）',
           abs(lw['obs300'] - lw['bareExp300']) < 0.02,
           f"obs300={lw['obs300']:.3f} bareExp300={lw['bareExp300']:.3f}")
    expect('t>=540 用 lateWeight（600s 杂兵占比≈晚期望）',
           abs(lw['obs600'] - lw['lateExp600']) < 0.02,
           f"obs600={lw['obs600']:.3f} lateExp600={lw['lateExp600']:.3f}")
    expect('lateWeight 抬高杂兵占比（obs600 > 裸 weight 期望值）',
           lw['obs600'] > lw['bareExp600'] + 0.01,
           f"obs600={lw['obs600']:.3f} bareExp600={lw['bareExp600']:.3f}")

    # 2e. P1 尾：threatTierName 难度感知（终焉仅 hard）
    print("--- 2e. threatTierName 难度感知（终焉仅 hard）---")
    tier = page.evaluate("""() => { const g=window.__game;
      g.setDifficulty('normal'); g.threatAuto=15; g.threatWager=0; g.threatLevel=15;
      const n = g.threatTierName();
      g.setDifficulty('hard'); g.threatLevel=15;
      const h = g.threatTierName();
      g.setDifficulty('normal'); g.threatLevel=0;
      return { normal:n, hard:h }; }""")
    expect('normal TL=15 称谓=永夜（非终焉，杜绝漂移）', tier['normal'] == '永夜', tier['normal'])
    expect('hard TL=15 称谓=终焉', tier['hard'] == '终焉', tier['hard'])
    badge = page.evaluate("""() => { const g=window.__game;
      g.setDifficulty('normal'); g.threatAuto=15; g.threatWager=0; g.threatLevel=15;
      g.ui.refreshThreatBadge();
      const t = document.getElementById('threat-tier').textContent;
      g.threatLevel=0; g.ui.refreshThreatBadge();
      return t; }""")
    expect('HUD 徽标 normal TL=15 显示 永夜', badge == '永夜', badge)

    # 2f. 运行到 t=600s：新怪/新词缀渲染无报错
    print("--- 2f. t=600s 新怪/新词缀渲染全程无报错 ---")
    err0 = len(errors)
    page.evaluate("""() => {
      const g = window.__game;
      // 冻结 Boss 状态，避免渲染等待期冒出新 Boss 干扰采样（保留 bossSpawned 防重刷）
      g.enemies.activeBoss = null;
      g.enemies.pendingBosses = [];
      g.enemies.bossReleasableAt = g.time + 1e9;
      g.enemies.enemies = [];
      g.state = 'playing';
      g.time = 600;
      g.expQueue = 0;
      const ls = document.getElementById('levelup-screen'); if (ls) ls.classList.add('hidden');
      g.player.hp = g.player.maxHp = 99999;
      const scale = g.enemies.statScale(false);
      const mk = (id, affix) => {
        const t = window.__enemyTypes[id];
        const e = g.enemies.createEnemy(t, scale, g.player.x + (Math.random()*200-100), g.player.y + (Math.random()*200-100), affix);
        g.enemies.enemies.push(e); return e;
      };
      ['rat_swarm','spitter','bone_knight','plague_bearer','siren','revenant'].forEach(id => mk(id));
      mk('bat','swift'); mk('skeleton','regen'); mk('slime','frost');
      mk('bone_knight','bulwark'); mk('spitter','leech');
    }""")
    page.wait_for_timeout(1200)  # 多帧渲染，触发敌怪绘制 + 词缀环分支
    rendered = page.evaluate("""() => {
      const g = window.__game;
      const ids = new Set(g.enemies.enemies.filter(e=>!e.isBoss).map(e=>e.type.id));
      const affixed = g.enemies.enemies.some(e => e.affixDef && ['swift','regen','leech','bulwark','frost'].includes(e.affix));
      return { newEnemies: ['rat_swarm','spitter','bone_knight','plague_bearer','siren','revenant'].filter(x=>ids.has(x)),
               affixed };
    }""")
    expect('新怪实例已渲染', len(rendered['newEnemies']) == 6, f"{rendered['newEnemies']}")
    expect('新词缀敌怪实例已渲染', rendered['affixed'])
    expect('t=600s 渲染全程无控制台报错', len(errors) == err0, str(errors[err0:err0+3]))
    page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.state = 'title'; }")
    page.wait_for_timeout(150)

    expect('探针期间总体无控制台报错', len(errors) == 0, str(errors[:3]))
    browser.close()

print('\n' + '=' * 56)
print('P2 内容探针判定: ' + ('PASS' if not fails else f'FAIL ({len(fails)}) -> {fails}'))
sys.exit(1 if fails else 0)
