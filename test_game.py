from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173/?debug'

def expect(name, cond):
    print(('PASS' if cond else 'FAIL'), name)
    return cond

def dismiss_upgrades(page, halt=False):
    """玩家击杀敌人会触发 level up 进入 upgrading 状态，需主动清理。
    halt=True 时把 state 切到 title 彻底停止 step 循环，避免再次触发升级。"""
    page.evaluate("""(halt) => {
      const g = window.__game;
      if (!g) return;
      g.expQueue = 0;
      if (g.state === 'upgrading') g.resumeFromUpgrade();
      if (halt) g.state = 'title';
      else g.state = 'playing';
      const el = document.getElementById('levelup-screen');
      if (el) el.classList.add('hidden');
    }""", halt)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # --- 新手指引：首启自动弹 + 常驻按钮（UX 改造，2026-07-23）---
    guide_autoshow = page.evaluate("() => !document.getElementById('guide-screen').classList.contains('hidden')")
    expect('首启自动弹出玩法说明', guide_autoshow)
    if guide_autoshow:
        page.click('#btn-guide-close')
        page.wait_for_timeout(200)
    expect('关闭后玩法说明隐藏', page.evaluate("() => document.getElementById('guide-screen').classList.contains('hidden')"))
    page.click('#btn-guide')
    page.wait_for_timeout(200)
    expect('常驻按钮可再开说明', page.evaluate("() => !document.getElementById('guide-screen').classList.contains('hidden')"))
    page.click('#btn-guide-close')
    page.wait_for_timeout(200)

    # --- 资产键存在性：立绘 + 祭坛图标（UX 改造）---
    expect('6 角色全身立绘键存在', page.evaluate("""() => ['portrait_wanderer','portrait_saint','portrait_berserker','portrait_thunder','portrait_bloodthirsty','portrait_apostle'].every(k => !!(window.__assets && window.__assets[k]))"""))
    expect('7 祭坛专属图标键存在', page.evaluate("""() => ['altar_hp','altar_spd','altar_dmg','altar_gain','altar_dual','altar_slot_weapon','altar_slot_passive'].every(k => !!(window.__assets && window.__assets[k]))"""))
    # --- 实体美术 A1/A2/A4：新精灵键存在 + 数据接线 ---
    expect('A1 3 Boss 专属精灵键存在', page.evaluate("""() => ['boss_baron','boss_queen','boss_overlord'].every(k => !!(window.__assets && window.__assets[k]))"""))
    expect('A2 宝箱专属精灵键存在', page.evaluate("() => !!(window.__assets && window.__assets['chest'])"))
    expect('A4 6 玩家血裔精灵键存在', page.evaluate("""() => ['player_wanderer','player_saint','player_berserker','player_thunder','player_bloodthirsty','player_apostle'].every(k => !!(window.__assets && window.__assets[k]))"""))
    expect('D1 亡灵光环半径随等级增长', page.evaluate("() => window.__weapons.aura.levels[4].radius > window.__weapons.aura.levels[0].radius"))
    expect('D1 圣水洗礼半径随等级增长', page.evaluate("() => window.__weapons.holywater.levels[4].radius > window.__weapons.holywater.levels[0].radius"))
    expect('D3 音效 zap/splash 方法存在', page.evaluate("() => typeof window.__game.audio.zap === 'function' && typeof window.__game.audio.splash === 'function'"))
    # Boss 精灵真被数据引用（不靠打满 180 秒实战）
    expect('A1 数据 BOSSES 各自指向 boss_* 精灵', page.evaluate("""() => window.__bosses.every(b => b.sprite.startsWith('boss_'))"""))

    # --- 基础流程：升级三选一（用 API 直接触发，不依赖玩家击杀） ---
    page.click('#btn-start')
    page.wait_for_timeout(400)
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'upgrading';
      g.upgrade.open(g.upgrade.rollOptions());
    }""")
    page.wait_for_timeout(300)
    upgraded = page.evaluate("() => !document.getElementById('levelup-screen').classList.contains('hidden')")
    if upgraded:
        page.click('.upgrade-card')
        page.wait_for_timeout(400)
    expect('升级三选一流程', upgraded)
    dismiss_upgrades(page)

    # --- 神器进化（圣水+引力宝珠） ---
    # 注意 addWeapon 不查重；若升级循环已选 holywater 会重复，进化只移除一个导致残留
    # 所以先清掉 holywater 再加，并强制设满级
    page.evaluate("""() => {
      const g = window.__game;
      g.player.weapons = g.player.weapons.filter(w => w.id !== 'holywater');
      g.weapons.addWeapon('holywater');
      const hw = g.player.weapons.find(w => w.id === 'holywater');
      if (hw) hw.level = 5;
      g.player.passives.set('magnet', 1);
      g.pickups.dropChest(g.player.x, g.player.y);
    }""")
    page.wait_for_timeout(900)
    dismiss_upgrades(page)
    expect('进化横幅出现', page.evaluate("() => !document.getElementById('evolution-banner').classList.contains('hidden')"))
    expect('获得神器 圣洁吞噬', page.evaluate("() => window.__game.weapons.hasArtifact('devour')"))
    expect('原武器 圣水洗礼 被替换', page.evaluate("() => !window.__game.weapons.hasWeapon('holywater')"))

    # --- Boss 战：3 分钟 血色男爵 ---
    dismiss_upgrades(page)
    page.evaluate("() => { window.__game.time = 181; }")
    page.wait_for_timeout(1200)
    boss_spawned = page.evaluate("() => window.__game.enemies.enemies.some(e => e.isBoss)")
    warn_shown = page.evaluate("() => document.getElementById('warn-name').textContent")
    expect('Boss 生成', boss_spawned)
    expect('登场警告显示"血色男爵"', warn_shown == '血色男爵')
    expect('A1 Boss 实例用 boss_baron 精灵', page.evaluate("""() => window.__game.enemies.enemies.some(e => e.isBoss && e.type && e.type.sprite === 'boss_baron')"""))
    page.screenshot(path='/tmp/e2e_boss_warn.png')

    # 等警告消失，血条出现
    page.wait_for_timeout(2500)
    dismiss_upgrades(page)
    expect('Boss 血条显示', page.evaluate("() => !document.getElementById('boss-bar-wrap').classList.contains('hidden')"))
    expect('血条名称"血色男爵"', page.evaluate("() => document.getElementById('boss-name').textContent == '血色男爵'"))

    # 阶段技能：打到 65% 触发召唤
    bats_before = page.evaluate("() => window.__game.enemies.enemies.filter(e => !e.isBoss && e.type && e.type.sprite === 'bat').length")
    page.evaluate("""() => {
      const b = window.__game.enemies.activeBoss;
      if (b) b.hp = b.maxHp * 0.65;
    }""")
    page.wait_for_timeout(600)
    dismiss_upgrades(page)
    bats_after = page.evaluate("() => window.__game.enemies.enemies.filter(e => !e.isBoss && e.type && e.type.sprite === 'bat').length")
    expect('65%血 召唤蝙蝠', bats_after > bats_before)

    # 打到 35% 触发弹幕
    page.evaluate("""() => {
      const b = window.__game.enemies.activeBoss;
      if (b) b.hp = b.maxHp * 0.35;
    }""")
    page.wait_for_timeout(600)
    dismiss_upgrades(page)
    expect('35%血 扇形弹幕', page.evaluate("() => window.__game.enemies.enemyProjectiles.length > 0"))
    page.screenshot(path='/tmp/e2e_boss_fight.png')

    # 击杀 Boss → 强化宝箱
    # 清空非 Boss 敌人/弹幕，避免 wait 期间击杀触发升级中断 step 导致 Boss 不死
    page.evaluate("""() => {
      const g = window.__game;
      g.enemies.enemies = g.enemies.enemies.filter(e => e.isBoss);
      g.enemies.enemyProjectiles = [];
      g.expQueue = 0;
      if (g.state === 'upgrading') g.resumeFromUpgrade();
      g.state = 'playing';
      document.getElementById('levelup-screen').classList.add('hidden');
      const b = g.enemies.activeBoss;
      if (b) b.hp = 0;
    }""")
    page.wait_for_timeout(1000)
    dismiss_upgrades(page)
    expect('Boss 死亡血条隐藏', page.evaluate("() => document.getElementById('boss-bar-wrap').classList.contains('hidden')"))
    boss_chest = page.evaluate("() => window.__game.pickups.gems.some(g => g.boss)")
    expect('Boss 掉落强化宝箱', boss_chest)
    expect('A2 Boss 宝箱用 chest 精灵键', page.evaluate("""() => window.__game.pickups.gems.some(g => g.boss && g.def.key === 'chest')"""))
    # 普通宝箱键接线（原子操作：drop + 断言 + 立即移除，避免自动拾取干扰后续）
    expect('A2 普通宝箱用 chest 精灵键', page.evaluate("""() => {
      const g = window.__game;
      g.pickups.dropChest(g.player.x, g.player.y);
      const ok = g.pickups.gems.some(x => x.chest && x.def.key === 'chest');
      g.pickups.gems = g.pickups.gems.filter(x => !x.chest);
      return ok;
    }"""))

    # 拾取强化宝箱 → 补偿（已进化完圣水配方，其余无满级武器 → 走补偿路径）
    # 直接同步调用 onChestOpened 避免拾取时序不确定性
    # 把 level 提到 999 让 expForLevel 巨大，确保 +40 经验不触发升级，方便精确断言
    page.evaluate("""() => {
      const g = window.__game;
      const idx = g.pickups.gems.findIndex(x => x.boss);
      if (idx >= 0) g.pickups.gems.splice(idx, 1);
      g.player.hp = 30;
      g.player.level = 999;
      g.player.exp = 0;
      g.onChestOpened({ boss: true });
    }""")
    expect('Boss 宝箱回满血', page.evaluate("() => window.__game.player.hp >= window.__game.player.maxHp"))
    expect('Boss 宝箱 +40 经验', page.evaluate("() => window.__game.player.exp >= 40"))

    # --- 续航：血瓶拾取回血 + 血色再生被动持续回血 ---
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];          // 清空敌人避免干扰回血断言
      g.player.level = 999;            // 避免拾取经验触发升级打断
      g.player.hp = 50;
      g.pickups.dropPotion(g.player.x, g.player.y, 20);
    }""")
    page.wait_for_timeout(400)
    expect('血瓶拾取回血', page.evaluate("() => window.__game.player.hp >= 70"))
    page.evaluate("""() => {
      const g = window.__game;
      g.player.hp = 50;
      g.player.regenRate = 10;         // 加速回血便于断言
    }""")
    page.wait_for_timeout(500)
    expect('血色再生持续回血', page.evaluate("() => window.__game.player.hp > 50"))
    page.evaluate("() => { window.__game.player.regenRate = 0; }")

    # --- 升级加权：每层至少1个武器向(配额) + 已有武器加权更易出现 ---
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];                               // 清空避免 step 干扰
      g.player.weapons = [{ id: 'blade', level: 1, timer: 0.4 }];  // 只留 blade L1(未满级)
      g.player.passives = new Map([['boots', 1]]);          // 只留 boots L1(已有)
      g.upgrade.banned.clear();
    }""")
    weighted = page.evaluate("""() => {
      const g = window.__game;
      let weaponHits = 0, bladeHits = 0;
      const N = 300;
      for (let i = 0; i < N; i++) {
        const opts = g.upgrade.rollOptions();
        if (opts.some(o => o.isWeapon)) weaponHits++;
        if (opts.some(o => o.id === 'blade')) bladeHits++;
      }
      return { weaponHits, bladeHits, N };
    }""")
    expect('每层至少1个武器向(配额)', weighted['weaponHits'] == weighted['N'])
    expect('加权倾向已有武器(blade命中率>35%)', weighted['bladeHits'] > weighted['N'] * 0.35)

    # --- S3 槽位上限：满 6 武器后新武器卡消失，但已有武器升级卡仍在 ---
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.player.level = 999;
      g.player.weapons = [];
      g.player.passives = new Map();
      g.upgrade.banned.clear();
      // 塞满 6 把武器（blade 进 LV2 未满级，用于验证升级卡仍在）
      const ids = ['blade','axe','holywater','lightning','aura','whip'];
      for (const id of ids) g.weapons.addWeapon(id);
      g.weapons.upgradeWeapon('blade');
    }""")
    capped = page.evaluate("""() => {
      const g = window.__game;
      let newW = 0, upW = 0;
      for (let i = 0; i < 200; i++) {
        const opts = g.upgrade.rollOptions();
        for (const o of opts) {
          if (o.kind === 'weapon-new') newW++;
          if (o.kind === 'weapon-up') upW++;
        }
      }
      return { newW, upW, count: g.player.weapons.length, max: g.player.maxWeapons };
    }""")
    expect('S3 满武器槽(6)新武器卡=0', capped['newW'] == 0)
    expect('S3 已满武器仍可升级(weapon-up>0)', capped['upW'] > 0)
    expect('S3 武器数=上限', capped['count'] == capped['max'])

    # 祭坛 +1 槽：购买后 startRun 注入上限提升
    page.evaluate("""() => {
      window.__souls.saveSouls({balance:9999,spent:0,unlocks:[],cleared:['normal']});
      window.__souls.buyUnlock('soul_slot_weapon');
      window.__souls.buyUnlock('soul_slot_passive');
      window.__game.startRun();
    }""")
    expect('S3 祭坛 +1 武器槽(上限7)', page.evaluate("() => window.__game.player.maxWeapons == 7"))
    expect('S3 祭坛 +1 被动槽(上限7)', page.evaluate("() => window.__game.player.maxPassives == 7"))
    # 回退灵魂存档，避免污染后续断言（图鉴/结算/血裔段依赖干净存档）
    page.evaluate("() => window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[],bloodlines:['wanderer'],selectedBloodline:'wanderer'})")

    # --- 新武器：可装备 + 开火命中（武器丰富化，2026-07-23）---
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.player.weapons = [];
      g.weapons.addWeapon('aura');
      g.weapons.addWeapon('whip');
      g.weapons.addWeapon('cross');
      g.enemies.enemies = [];
      g.expQueue = 0;
      g.player.level = 999;            // 防止 wait 期间击杀触发升级中断 step
      // 用游戏自身 createEnemy 生成完整靶子（手写 dummy 缺 speed 等字段会在 update 里变 NaN）
      const type = g.enemies.pickType();
      const dummy = g.enemies.createEnemy(type, g.enemies.statScale(), g.player.x + 30, g.player.y);
      dummy.hp = 9999; dummy.maxHp = 9999; dummy.speed = 0;   // 静止贴脸厚血靶
      g.enemies.enemies.push(dummy);
      g.__testDummy = dummy;
    }""")
    page.wait_for_timeout(1300)
    fired = page.evaluate("""() => {
      const g = window.__game;
      const dummy = g.__testDummy;
      return {
        aura: g.weapons.hasWeapon('aura'),
        whip: g.weapons.hasWeapon('whip'),
        cross: g.weapons.hasWeapon('cross'),
        dmgHappened: !dummy || dummy.hp < 9999,
      };
    }""")
    expect('新武器 亡灵光环 可装备', fired['aura'])
    expect('新武器 噬魂长鞭 可装备', fired['whip'])
    expect('新武器 黎明圣印 可装备', fired['cross'])
    expect('新武器开火命中敌人', fired['dmgHappened'])
    # 清理靶子与敌人，避免影响后续断言
    page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.expQueue = 0; }")

    # --- 新配方进化：武器满级+被动 → 神器（武器丰富化，2026-07-23）---
    for wid, pid, aid in [('aura','heart','sepulcher'), ('whip','boots','eternalwhip'), ('cross','tome','matrix')]:
        page.evaluate("""(args) => {
          const g = window.__game;
          const wid = args[0], pid = args[1], aid = args[2];
          g.state = 'playing';
          g.enemies.enemies = [];
          g.expQueue = 0;
          if (g.state === 'upgrading') g.resumeFromUpgrade();
          g.state = 'playing';
          document.getElementById('levelup-screen').classList.add('hidden');
          g.player.weapons = [];
          g.player.passives = new Map();
          g.weapons.addWeapon(wid);
          const w = g.player.weapons.find(x => x.id === wid);
          if (w) w.level = 5;
          g.player.passives.set(pid, 1);
          g.onChestOpened({ boss: true });
        }""", [wid, pid, aid])
        page.wait_for_timeout(400)
        dismiss_upgrades(page)
        got = page.evaluate("""(aid) => window.__game.weapons.hasArtifact(aid)""", aid)
        expect(f'新配方进化 → {aid} 神器', got)
        page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.expQueue = 0; }")

    # --- 图鉴验证 ---
    page.evaluate("() => window.__game.ui.showTitle()")
    page.wait_for_timeout(300)
    dismiss_upgrades(page, halt=True)
    page.click('#btn-codex')
    page.wait_for_timeout(500)
    # 图鉴卡片 = 武器(7) + 被动道具(9) + 神器(9) = 25，随 data.js 新增条目需同步更新此处
    codex = page.evaluate("""() => {
      const secs = [...document.querySelectorAll('.codex-section')];
      const byTitle = {};
      for (const s of secs) {
        const t = s.querySelector('h3').textContent;
        byTitle[t] = s.querySelectorAll('.codex-card').length;
      }
      return { total: document.querySelectorAll('.codex-card').length, byTitle };
    }""")
    expect('图鉴卡片总数 25 (7武器+9被动+9神器)', codex['total'] == 25)
    expect('图鉴 武器7张', codex['byTitle'].get('武器') == 7)
    expect('图鉴 被动道具9张', codex['byTitle'].get('被动道具') == 9)
    expect('图鉴 神器9张', codex['byTitle'].get('神器') == 9)
    expect('图鉴 圣洁吞噬 已解锁', page.evaluate("""() => [...document.querySelectorAll('.codex-card')].some(c => !c.classList.contains('locked') && c.textContent.includes('圣洁吞噬'))"""))
    page.screenshot(path='/tmp/e2e_codex_final.png')

    # --- 灵魂货币：结算发灵魂 + 祭坛解锁（长期循环）---
    # 重置灵魂存档，避免历史状态干扰断言
    page.evaluate("() => window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[]})")
    # 构造一次死亡结算：5分钟(5) + 60击杀(3) + LV12(12) + 1Boss(25) + 难度首通normal(100) = 145
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.time = 150; g.kills = 60; g.player.level = 12; g.bossKills = 1; g.soulGainMul = 1;
      g.player.hp = 0;
      g.gameOver();
    }""")
    page.wait_for_timeout(300)
    soul = page.evaluate("""() => ({
      run: window.__game.runSouls,
      total: window.__game.totalSouls,
      stored: window.__souls.loadSouls().balance,
      cleared: window.__souls.loadSouls().cleared,
    })""")
    expect('结算发放灵魂>0', soul['run'] > 0)
    expect('结算灵魂=145(含首通)', soul['run'] == 145)
    expect('灵魂已持久化且等于本局', soul['stored'] == soul['run'])
    expect('难度首通已记录', 'normal' in soul['cleared'])

    # 祭坛解锁：购买后余额扣减 + 永久生效（重置为干净 1000，隔离结算残留）
    page.evaluate("""() => {
      window.__souls.saveSouls({balance:1000, spent:0, unlocks:[], cleared:['normal']});
      window.__souls.buyUnlock('soul_hp');   // 花费 60
    }""")
    bought = page.evaluate("""() => ({
      unlocked: window.__souls.isUnlocked('soul_hp'),
      balance: window.__souls.loadSouls().balance,
    })""")
    expect('祭坛解锁成功', bought['unlocked'])
    expect('解锁扣减灵魂(1000-60=940)', bought['balance'] == 940)
    # 开局注入：永恒之躯(maxHp+30) → 130
    page.evaluate("() => window.__game.startRun()")
    expect('祭坛增益开局生效(maxHp≥130)', page.evaluate("() => window.__game.player.maxHp >= 130"))
    # 返回主界面确认灵魂余额可见
    page.evaluate("() => window.__game.showTitle()")
    page.wait_for_timeout(200)
    expect('主界面显示灵魂余额', page.evaluate("() => !document.getElementById('soul-balance').classList.contains('hidden')"))

    # 祭坛卡片均用专属图标（不复用旧素材，UX 改造，2026-07-23）
    page.evaluate("() => window.__game.ui.showAltar()")
    page.wait_for_timeout(300)
    expect('祭坛图标不复用旧素材(均为 altar_*)', page.evaluate("""() => window.__altar.every(a => a.icon.startsWith('altar_'))"""))
    expect('祭坛卡片全部正常渲染', page.evaluate("""() => [...document.querySelectorAll('#altar-content .altar-card img')].every(img => img.complete && img.naturalWidth > 0)"""))
    page.evaluate("() => window.__game.ui.hideAltar()")

    # --- 血裔系统：开局角色差异（S2）---
    # 重置灵魂存档为干净状态（含血裔字段），隔离前面祭坛/结算残留，余额给足用于解锁
    page.evaluate("() => window.__souls.saveSouls({balance:9999,spent:0,unlocks:[],cleared:['normal'],bloodlines:['wanderer'],selectedBloodline:'wanderer'})")

    # 默认血裔 流浪者：起手 blade + 微幅全能力(damageMul>1)
    wl = page.evaluate("""() => {
      window.__bloodlines.setBloodline('wanderer');
      window.__game.startRun();
      const p = window.__game.player;
      return { id: window.__game.bloodline, weapons: p.weapons.map(w=>w.id), dmg: p.damageMul, hp: p.maxHp };
    }""")
    expect('默认血裔=流浪者', wl['id'] == 'wanderer')
    expect('流浪者起手 血之飞刃', wl['weapons'] == ['blade'])
    expect('流浪者 微幅全能力(damageMul>1)', wl['dmg'] > 1)

    # 圣徒：圣水起手 + 范围倍率>1
    saint = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('saint');
      window.__bloodlines.setBloodline('saint');
      window.__game.startRun();
      const p = window.__game.player;
      return { weapons: p.weapons.map(w=>w.id), area: p.areaMul };
    }""")
    expect('圣徒 解锁+选择', page.evaluate("() => window.__bloodlines.isBloodlineUnlocked('saint')"))
    expect('圣徒起手 圣水洗礼', saint['weapons'] == ['holywater'])
    expect('圣徒 范围倍率>1', saint['area'] > 1)

    # 狂战：战斧起手 + 冷却倍率<1 + 移速>1
    ber = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('berserker');
      window.__bloodlines.setBloodline('berserker');
      window.__game.startRun();
      const p = window.__game.player;
      return { weapons: p.weapons.map(w=>w.id), cd: p.cooldownMul, spd: p.speedMul };
    }""")
    expect('狂战起手 回旋战斧', ber['weapons'] == ['axe'])
    expect('狂战 冷却倍率<1(更快)', ber['cd'] < 1)
    expect('狂战 移速倍率>1', ber['spd'] > 1)

    # 雷巫：雷霆起手 + 冷却缩减<1
    th = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('thunder');
      window.__bloodlines.setBloodline('thunder');
      window.__game.startRun();
      const p = window.__game.player;
      return { weapons: p.weapons.map(w=>w.id), cd: p.cooldownMul };
    }""")
    expect('雷巫起手 雷霆审判', th['weapons'] == ['lightning'])
    expect('雷巫 冷却缩减<1', th['cd'] < 1)

    # 嗜血者：飞刃起手 + 命中回血>0 + 伤害>1
    bt = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('bloodthirsty');
      window.__bloodlines.setBloodline('bloodthirsty');
      window.__game.startRun();
      const p = window.__game.player;
      return { weapons: p.weapons.map(w=>w.id), ls: p.lifesteal, dmg: p.damageMul };
    }""")
    expect('嗜血者起手 血之飞刃', bt['weapons'] == ['blade'])
    expect('嗜血者 命中回血>0', bt['ls'] > 0)
    expect('嗜血者 伤害>1', bt['dmg'] > 1)

    # 永夜使徒(隐藏)：无武器起手 + 生命-20 + 高伤高移速
    ap = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('apostle');
      window.__bloodlines.setBloodline('apostle');
      window.__game.startRun();
      const p = window.__game.player;
      return { weapons: p.weapons.map(w=>w.id), hp: p.maxHp, dmg: p.damageMul, spd: p.speedMul, cd: p.cooldownMul };
    }""")
    expect('永夜使徒 解锁成功(隐藏)', page.evaluate("() => window.__bloodlines.isBloodlineUnlocked('apostle')"))
    expect('永夜使徒 无武器起手', ap['weapons'] == [])
    expect('永夜使徒 生命-20(<100)', ap['hp'] < 100)
    expect('永夜使徒 高伤高移速', ap['dmg'] > 1 and ap['spd'] > 1)

    # 隐藏血裔未解锁时不显示 + 标题显示当前血裔
    page.evaluate("""() => {
      window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[],bloodlines:['wanderer'],selectedBloodline:'wanderer'});
      window.__game.ui.showBloodline();
    }""")
    hidden_shown = page.evaluate("() => [...document.querySelectorAll('#bloodline-content .altar-card')].some(c => c.textContent.includes('永夜使徒'))")
    expect('隐藏血裔未解锁不显示', not hidden_shown)
    expect('血裔卡含初始武器说明', page.evaluate("() => document.getElementById('bloodline-content').innerHTML.includes('初始武器')"))
    page.evaluate("() => window.__game.ui.hideBloodline()")  # 触发 showTitle 更新标签
    page.wait_for_timeout(150)
    expect('标题显示当前血裔', page.evaluate("() => document.getElementById('btn-bloodline').textContent.includes('流浪者')"))

    print('控制台错误:', errors if errors else '无')
    browser.close()
