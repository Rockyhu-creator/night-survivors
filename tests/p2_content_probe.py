"""v4.0 P2 数据层内容探针（轻量）

驱动运行中的真实游戏（?debug + 手动泵 g.enemies.update，冻结 rAF 步进），
验证 P2 铺进 src/data.js 的新内容能被现有 spawn 逻辑调度，且不出错：

  · 6 新小怪 + revenant_shard 存在于 ENEMY_TYPES，字段齐全
  · 5 新词缀存在且带 minTime；shielded 补 minTime:60
  · 3 新 Boss 存在于 BOSSES，unlockAt 正确，仅用现有 6 种 skill type
  · 新怪在各自 unlockAt 后进入刷怪池（pickType 实际抽到）
  · Boss 串行化：herald/alchemist/warlord 都会被调度进 bossSpawned
  · 词缀分时段：t=10 绝不投出 5 个新词缀（minTime 门控）
  · 探针全程无控制台/页面报错

不验证数值平衡（全部 [待真机校准]），不验证 P3 差异化行为。
"""
import sys
from playwright.sync_api import sync_playwright

PORT = 5174  # vite 实际端口（5173 被占用时顺延）
URL = f'http://localhost:{PORT}/?debug'

fails = []


def expect(name, cond, detail=''):
    print(f"{'PASS' if cond else 'FAIL'} {name}{('  ' + detail) if detail else ''}")
    if not cond:
        fails.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
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
      const affixes = (window.__game && window.__game.enemies)
        ? null : null;
      return {
        enemyKeys: Object.keys(m),
        bossIds: b.map(x => x.id),
        bosses: b.map(x => ({id:x.id, unlockAt:x.unlockAt,
          skills:(x.skills||[]).map(s=>s.type)})),
      };
    }""")
    # AFFIXES 通过导入模块读取
    affix = page.evaluate("""async () => {
      const m = await import('/src/data.js');
      return Object.fromEntries(Object.entries(m.AFFIXES).map(([k,v]) => [k,
        {minTime: v.minTime ?? 0, expMul: v.expMul, color: v.color}]));
    }""")

    NEW_ENEMIES = ['rat_swarm', 'spitter', 'bone_knight', 'plague_bearer', 'siren', 'revenant', 'revenant_shard']
    for k in NEW_ENEMIES:
        expect(f'ENEMY_TYPES 含 {k}', k in data['enemyKeys'], str(data['enemyKeys']))
    # revenant_shard 必为 weight 0（只由分裂生成）
    shard = page.evaluate("() => window.__enemyTypes.revenant_shard")
    expect('revenant_shard.weight === 0（不进刷怪池）', shard and shard.get('weight') == 0, str(shard))
    # 新怪必需字段
    for k in NEW_ENEMIES[:-1]:
        e = page.evaluate(f"() => window.__enemyTypes['{k}']")
        ok = e and all(f in e for f in ('id', 'unlockAt', 'weight', 'exp', 'hp', 'speed', 'damage'))
        expect(f'{k} 字段齐全(id/unlockAt/weight/exp/hp/spd/dmg)', ok, str(e))

    NEW_AFFIXES = ['swift', 'regen', 'leech', 'bulwark', 'frost']
    for k in NEW_AFFIXES:
        expect(f'AFFIXES 含 {k}', k in affix, '')
    # minTime 门控值
    expect('swift.minTime === 30', affix.get('swift', {}).get('minTime') == 30)
    expect('regen.minTime === 150', affix.get('regen', {}).get('minTime') == 150)
    expect('leech.minTime === 210', affix.get('leech', {}).get('minTime') == 210)
    expect('bulwark.minTime === 300', affix.get('bulwark', {}).get('minTime') == 300)
    expect('frost.minTime === 240', affix.get('frost', {}).get('minTime') == 240)
    # ② design 偏差：shielded 补 minTime:60
    expect('shielded.minTime === 60（design §5.2）', affix.get('shielded', {}).get('minTime') == 60)
    # 新怪 bone_knight 带 affixBan:['bulwark']
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
    # 每个时间点：设置 g.time，保活玩家，杀掉当前 activeBoss（若有），泵一次 update
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

    # 2c. 词缀分时段：t=10 绝不投出 5 个新词缀（minTime 门控）
    print("--- 2c. 词缀 minTime 门控（t=10 不投新词缀）---")
    early = page.evaluate("""() => {
      const g = window.__game; g.time = 10;
      const NEW = ['swift','regen','leech','bulwark','frost'];
      let hit = 0;
      for (let i = 0; i < 2000; i++) { const a = g.enemies.rollSingleAffix(); if (a && NEW.includes(a)) hit++; }
      return hit;
    }""")
    expect('t=10 投出 0 个新词缀（minTime 拦截）', early == 0, f'hit={early}')

    # 2d. 渲染路径不崩：切回 playing 渲染一帧（含新怪/新词缀光环/复用 Boss 立绘）
    print("--- 2d. 渲染路径冒烟 ---")
    page.evaluate("""() => {
      const g = window.__game;
      g.time = 600;
      // 强制生成若干带新词缀的新怪，触发光环渲染分支
      for (let i = 0; i < 30; i++) g.enemies.spawnAt(g.enemies.pickType(), g.enemies.statScale(false), 'swift');
      g.state = 'paused'; g.render();
    }""")

    expect('探针全程无控制台/页面报错', len(errors) == 0, str(errors[:3]))
    browser.close()

print('\n' + '=' * 56)
print('P2 内容探针判定: ' + ('PASS' if not fails else f'FAIL ({len(fails)}) -> {fails}'))
sys.exit(1 if fails else 0)
