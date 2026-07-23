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

    # --- 图鉴验证 ---
    page.evaluate("() => window.__game.ui.showTitle()")
    page.wait_for_timeout(300)
    dismiss_upgrades(page, halt=True)
    page.click('#btn-codex')
    page.wait_for_timeout(500)
    # 图鉴卡片 = 武器(4) + 被动道具(9) + 神器(6) = 19，随 data.js 新增条目需同步更新此处
    codex = page.evaluate("""() => {
      const secs = [...document.querySelectorAll('.codex-section')];
      const byTitle = {};
      for (const s of secs) {
        const t = s.querySelector('h3').textContent;
        byTitle[t] = s.querySelectorAll('.codex-card').length;
      }
      return { total: document.querySelectorAll('.codex-card').length, byTitle };
    }""")
    expect('图鉴卡片总数 19 (4武器+9被动+6神器)', codex['total'] == 19)
    expect('图鉴 武器4张', codex['byTitle'].get('武器') == 4)
    expect('图鉴 被动道具9张', codex['byTitle'].get('被动道具') == 9)
    expect('图鉴 神器6张', codex['byTitle'].get('神器') == 6)
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

    print('控制台错误:', errors if errors else '无')
    browser.close()
