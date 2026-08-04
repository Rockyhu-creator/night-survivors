"""威胁等级 TL 轻量探针（v4.0 P1 验证）

直接驱动运行中的真实 `EnemyManager.statScale()` / `effSpawnMul()`，
不复刻公式（避免"用同一份错误公式自证"）。旧版基线用 v3.14 的常量解析式计算。

判据（design §1.4）：
  · TL=0  相对 v3.14 旧版 → ±10% 内（目标 +7.3%）
  · TL=10 相对 v3.14 旧版 → +60%~+80%（目标 +73%）
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173/?debug'
# v3.14 旧版 normal 常量（用于基线对照）
OLD = {'hpSlope': 0.26, 'dmgSlope': 0.14, 'nightBase': 1.16, 'artifactCounter': 0.15, 'spawnMul': 0.70}

fails = []


def expect(name, cond, detail=''):
    print(f"{'PASS' if cond else 'FAIL'} {name}{('  ' + detail) if detail else ''}")
    if not cond:
        fails.append(name)


def old_mult(t, artifacts, slope, is_boss=False):
    """v3.14 statScale 解析式：linear × nightBase^exp × (1 + artifactCounter×n×D)"""
    D = max(0.0, (t - 540) / 60)
    e = D if is_boss else D / 2
    return (1 + (t / 60) * slope) * (OLD['nightBase'] ** e) * (1 + OLD['artifactCounter'] * artifacts * D)


PROBE = """
([diffId, tl, t, artifacts]) => {
  const g = window.__game;
  g.setDifficulty(diffId);
  g.startRun();
  g.state = 'paused';               // 冻结主循环，避免探针期间被 step() 覆写
  g.time = t;
  g.threatAuto = tl; g.threatWager = 0; g.threatLevel = tl;   // 直接定档，绕开 localStorage
  g.player.weapons.length = 0;
  for (let i = 0; i < artifacts; i++) g.player.weapons.push({ artifact: true });
  const mob = g.enemies.statScale(false);
  const boss = g.enemies.statScale(true);
  const interval = Math.max(0.22, 0.9 - t / 160) / g.enemies.effSpawnMul();
  return { hp: mob.hp, damage: mob.damage, speed: mob.speed,
           bossHp: boss.hp, spawnMul: g.enemies.effSpawnMul(), interval };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function("() => window.__game && window.__game.state !== 'loading'", timeout=20000)
    page.evaluate("() => window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[],tree:[]})")

    T, ART = 720, 4
    print(f"\n=== 口径：normal / t={T}s / 神器 {ART} 件 / 非 Boss（对齐 design §1.4）===")
    base_hp_old = old_mult(T, ART, OLD['hpSlope'])
    base_dmg_old = old_mult(T, ART, OLD['dmgSlope'])
    print(f"v3.14 旧版基线   hp {base_hp_old:6.2f}×   damage {base_dmg_old:6.2f}×")

    rows = {}
    for tl in (0, 5, 10):
        r = page.evaluate(PROBE, ['normal', tl, T, ART])
        rows[tl] = r
        print(f"TL={tl:<2}  hp {r['hp']:6.2f}× ({(r['hp'] / base_hp_old - 1) * 100:+6.1f}%)   "
              f"damage {r['damage']:6.2f}× ({(r['damage'] / base_dmg_old - 1) * 100:+6.1f}%)   "
              f"spawnMul {r['spawnMul']:.3f}  interval {r['interval']:.3f}s")

    d0 = rows[0]['hp'] / base_hp_old - 1
    dd0 = rows[0]['damage'] / base_dmg_old - 1
    expect('TL=0 敌人 HP 相对旧版在 ±10% 内', abs(d0) <= 0.10, f"{d0 * 100:+.1f}% (目标 +7.3%)")
    expect('TL=0 敌人伤害相对旧版在 ±10% 内', abs(dd0) <= 0.10, f"{dd0 * 100:+.1f}%")

    d10 = rows[10]['hp'] / base_hp_old - 1
    expect('TL=10 敌人 HP 相对旧版落在 +60%~+80%', 0.60 <= d10 <= 0.80, f"{d10 * 100:+.1f}% (目标 +73%)")
    d10v0 = rows[10]['hp'] / rows[0]['hp'] - 1
    expect('TL=10 相对 TL=0 落在 +55%~+70%', 0.55 <= d10v0 <= 0.70, f"{d10v0 * 100:+.1f}% (design 算得 +61.6%)")

    expect('TL 单调递增 (0<5<10)', rows[0]['hp'] < rows[5]['hp'] < rows[10]['hp'])
    expect('speed 不受 TL 影响', rows[0]['speed'] == rows[10]['speed'], f"{rows[0]['speed']:.3f}")
    expect('TL=10 spawnMul == 0.925 (design §1.2 表)', abs(rows[10]['spawnMul'] - 0.925) < 1e-9,
           f"{rows[10]['spawnMul']:.4f}")

    # TL=0 短路分支必须与"基线常量解析式"逐位一致（证明 TL=0 无任何额外乘区）
    def new_mult(t, artifacts, slope, night, ac, is_boss=False):
        D = max(0.0, (t - 540) / 60)
        e = D if is_boss else D / 2
        return (1 + (t / 60) * slope) * (night ** e) * (1 + ac * artifacts * D)

    ref = new_mult(T, ART, 0.28, 1.17, 0.15)
    expect('TL=0 与基线解析式逐位一致', abs(rows[0]['hp'] - ref) < 1e-9, f"{rows[0]['hp']:.9f} vs {ref:.9f}")

    # 早期无感验证：t=120s 时 TL=0 vs 旧版
    r120 = page.evaluate(PROBE, ['normal', 0, 120, 0])
    old120 = old_mult(120, 0, OLD['hpSlope'])
    expect('TL=0 / t=120s 前期相对旧版 ±10% 内', abs(r120['hp'] / old120 - 1) <= 0.10,
           f"{(r120['hp'] / old120 - 1) * 100:+.1f}%")

    print("\n=== 硬上限护栏：hard 极限 TL=17 (tlMax12 + wager5) ===")
    for t in (720, 900):
        cap = page.evaluate(PROBE, ['hard', 17, t, 4])
        b = page.evaluate(PROBE, ['hard', 0, t, 4])
        amp_hp = cap['hp'] / b['hp']
        amp_dmg = cap['damage'] / b['damage']
        print(f"t={t}s  TL=0 hp {b['hp']:7.2f}×  →  TL=17 hp {cap['hp']:7.2f}×  放大 {amp_hp:.3f}×  "
              f"(damage 放大 {amp_dmg:.3f}×)  spawnMul {cap['spawnMul']:.3f}")
        expect(f'hard t={t} HP 放大倍数 ≤ TL_HP_AMP_CAP(2.20)', amp_hp <= 2.2001, f"{amp_hp:.3f}")
        expect(f'hard t={t} 伤害放大倍数 ≤ TL_DMG_AMP_CAP(1.80)', amp_dmg <= 1.8001, f"{amp_dmg:.3f}")
        expect(f'hard t={t} spawnMul ≤ TL_SPAWN_MUL_CAP(1.60)', cap['spawnMul'] <= 1.6001,
               f"{cap['spawnMul']:.3f}")

    print("\n=== easy 档新手保护（基线常量完全未动）===")
    e0 = page.evaluate(PROBE, ['easy', 0, T, ART])
    D = (T - 540) / 60
    easy_old = (1 + (T / 60) * 0.18) * (1.08 ** (D / 2)) * (1 + 0.08 * ART * D)
    expect('easy TL=0 与旧版逐位一致（easy 未做任何基线上调）', abs(e0['hp'] - easy_old) < 1e-9,
           f"{e0['hp']:.6f} vs {easy_old:.6f}")

    print("\n=== TL 回报通道 ===")
    rw = page.evaluate("""() => { const g = window.__game;
      g.threatAuto = 10; g.threatWager = 0; g.threatLevel = 10;
      return { soul: g.threatSoulMul(), exp: g.threatExpMul(), tier: g.threatTierName() }; }""")
    print(f"TL=10 → soulMul ×{rw['soul']:.2f}  expMul ×{rw['exp']:.2f}  称谓「{rw['tier']}」")
    expect('TL=10 灵魂 ×1.50', abs(rw['soul'] - 1.5) < 1e-9)
    expect('TL=10 经验 ×1.20', abs(rw['exp'] - 1.2) < 1e-9)
    expect('TL=10 称谓=永夜', rw['tier'] == '永夜')

    print("\n=== TL_auto 局外投入折算（真实 localStorage 通道）===")
    # 按 cost 从大到小买满到目标投入额，走 computeAutoThreat / treeInvestedSouls 真实路径
    SEED = """
    async ([diffId, target]) => {
      const m = await import('/src/data.js');
      const nodes = [...m.SKILL_TREE].sort((a, b) => b.cost - a.cost);
      const tree = []; let sum = 0;
      for (const n of nodes) { if (sum >= target) break; tree.push(n.id); sum += n.cost; }
      const s = m.loadSouls(); s.tree = tree; m.saveSouls(s);
      const g = window.__game; g.setDifficulty(diffId); g.threatWager = 0; g.refreshThreat();
      return { invest: sum, nodes: tree.length, auto: g.threatAuto, tl: g.threatLevel,
               tlMax: g.difficulty.tlMax,
               fullTreeCost: m.SKILL_TREE.reduce((a, n) => a + n.cost, 0) };
    }"""
    for diff_id, target in (('normal', 0), ('normal', 1200), ('normal', 6000), ('normal', 99999),
                            ('easy', 99999), ('hard', 99999)):
        r = page.evaluate(SEED, [diff_id, target])
        print(f"{diff_id:<6} 投入 {r['invest']:>6} 灵魂 ({r['nodes']:>2} 节点)  →  TL_auto {r['auto']}"
              f"  (tlMax {r['tlMax']}, 满树成本 {r['fullTreeCost']})")
        expect(f'{diff_id} 投入 {r["invest"]} → TL_auto = min(floor(invest/1200), tlMax)',
               r['auto'] == min(r['tlMax'], r['invest'] // 1200), f"实得 {r['auto']}")
    full = page.evaluate(SEED, ['normal', 99999])
    expect('满树(13750)在 normal 触及 tlMax=10 上限', full['auto'] == 10 and full['invest'] // 1200 == 11,
           f"floor(13750/1200)={13750 // 1200} → 夹紧到 {full['auto']}")

    print("\n=== 下调兜底（Autonomy）+ 加码上限 ===")
    auto = page.evaluate("""() => { const g = window.__game;
      g.setDifficulty('normal'); g.threatWager = 0; g.refreshThreat();
      const start = g.threatLevel;
      const down = []; for (let i = 0; i < 14; i++) { down.push(g.adjustThreat(-1)); }
      const up = []; for (let i = 0; i < 18; i++) { up.push(g.adjustThreat(1)); }
      return { start, down, up, auto: g.threatAuto, wagerMax: g.difficulty.wagerMax }; }""")
    print(f"起始 TL {auto['start']} (auto {auto['auto']})")
    print(f"连续下调 → {auto['down']}")
    print(f"连续加码 → {auto['up']} (wagerMax {auto['wagerMax']})")
    expect('起始 TL == TL_auto（默认不加码不下调）', auto['start'] == auto['auto'])
    expect('可一路下调到 TL=0 且不越界为负', auto['down'][-1] == 0 and min(auto['down']) == 0)
    expect('加码封顶 = TL_auto + wagerMax', max(auto['up']) == auto['auto'] + auto['wagerMax'],
           f"{max(auto['up'])} vs {auto['auto']}+{auto['wagerMax']}")

    print("\n=== UI 可见性 ===")
    ui = page.evaluate("""() => { const g = window.__game;
      g.ui.showTitle();
      const panel = document.getElementById('threat-select');
      // 必须在 startRun() 隐藏标题屏之前取，否则读到的是隐藏后的状态
      const panelVisible = !!panel && panel.getBoundingClientRect().height > 0;
      document.getElementById('btn-threat-up').click();
      const afterUp = { name: document.getElementById('threat-name').textContent,
                        num: document.getElementById('threat-num').textContent,
                        desc: document.getElementById('threat-desc').textContent, tl: g.threatLevel };
      g.startRun();
      const badgeOn = !document.getElementById('threat-badge').classList.contains('hidden');
      const tierTxt = document.getElementById('threat-tier').textContent;
      g.threatAuto = 0; g.threatWager = 0; g.threatLevel = 0; g.ui.refreshThreatBadge();
      const badgeOff = document.getElementById('threat-badge').classList.contains('hidden');
      return { panelVisible, afterUp, badgeOn, tierTxt, badgeOff }; }""")
    print(f"面板可见 {ui['panelVisible']} | ＋后 TL={ui['afterUp']['tl']} 「{ui['afterUp']['name']}」 "
          f"{ui['afterUp']['num']}\n  {ui['afterUp']['desc']}")
    expect('开局面板在主界面可见', ui['panelVisible'])
    expect('点击＋ 面板同步更新 TL', ui['afterUp']['tl'] > 0 and 'TL' in ui['afterUp']['num'])
    expect('TL>0 时 HUD 徽标显示且带称谓', ui['badgeOn'] and len(ui['tierTxt']) > 0, ui['tierTxt'])
    expect('TL=0 时 HUD 徽标隐藏（新手零打扰）', ui['badgeOff'])

    page.evaluate("() => window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[],tree:[]})")

    expect('探针期间无控制台报错', len(errors) == 0, str(errors[:3]))
    browser.close()

print('\n' + '=' * 56)
print('TL 探针判定: ' + ('PASS' if not fails else f'FAIL ({len(fails)}) -> {fails}'))
sys.exit(1 if fails else 0)
