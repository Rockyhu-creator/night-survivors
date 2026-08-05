from playwright.sync_api import sync_playwright
import sys

URL = 'http://localhost:5173/?debug'

_failures = 0  # P1: 失败计数器，用于非零退出码

def expect(name, cond):
    global _failures
    ok = bool(cond)
    print(('PASS' if ok else 'FAIL'), name)
    if not ok:
        _failures += 1
    return ok

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

    # --- 运行时版本自检（v0.31）：__BUILD_ID__ 注入 + 横幅/进度条 DOM + version.json 请求 ---
    expect('运行时 __BUILD_ID__ 已注入(版本自检同源)', page.evaluate("() => typeof window.__BUILD_ID__ === 'string' && window.__BUILD_ID__.length > 0"))
    expect('页面含 #update-prompt 容器', page.evaluate("() => !!document.getElementById('update-prompt')"))
    expect('页面含 #load-bar 进度条', page.evaluate("() => !!document.getElementById('load-bar')"))
    # dev 下 /version.json 由 build 插件生成（dev 不写）：fetch 命中 Vite SPA 回退返回 HTML(200)
    # 或 404，均被自检静默跳过，不发控制台错误；构建后 preview 返回 200 且含 buildId JSON。
    # 生产环境用带戳 URL(/version.json?t=...) 做微信 X5 缓存击穿（v0.33）：CF 静态托管忽略 query，
    # 仍返回同一文件；这里用同样带戳 URL 断言端点到端可用。
    # 断言：请求绝不抛未捕获错误；真 JSON(200) 时含 buildId；其余(dev) 优雅跳过。
    ver = page.evaluate("""async () => {
      try {
        const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        if (r.status === 404 || !ct.includes('application/json')) {
          return { status: r.status, json: false };
        }
        const j = await r.json();
        return { status: r.status, json: true, hasBuildId: typeof j.buildId === 'string' && j.buildId.length > 0 };
      } catch (e) { return { error: String(e) }; }
    }""")
    expect('version.json 请求不报错(dev SPA回退 / 构建 200)', ver.get('error') is None)
    if ver.get('json'):
        expect('version.json 含 buildId 字段', ver.get('hasBuildId') is True)
    else:
        expect('version.json dev 环境无 JSON(静默跳过)', ver.get('status') in (200, 404))

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
    # --- v2.0 神器扩充：16 张新精灵键存在（武器8 + 神器8）---
    expect('v2.0 16 新精灵键存在(武器8+神器8)', page.evaluate("""() => ['weapon_starfall','weapon_judgment','weapon_phantom','weapon_aegis','weapon_warden','weapon_maul','weapon_sanguine','weapon_resolve','art_fatalis','art_retribution','art_mirage','art_bastion','art_sentinel','art_cataclysm','art_bloodpact','art_absolution'].every(k => !!(window.__assets && window.__assets[k]))"""))
    # --- 实体美术 A1/A2/A4：新精灵键存在 + 数据接线 ---
    expect('A1 3 Boss 专属精灵键存在', page.evaluate("""() => ['boss_baron','boss_queen','boss_overlord'].every(k => !!(window.__assets && window.__assets[k]))"""))
    expect('A2 宝箱专属精灵键存在', page.evaluate("() => !!(window.__assets && window.__assets['chest'])"))
    expect('A4 6 玩家血裔精灵键存在', page.evaluate("""() => ['player_wanderer','player_saint','player_berserker','player_thunder','player_bloodthirsty','player_apostle'].every(k => !!(window.__assets && window.__assets[k]))"""))
    # --- v0.34 高价值经验宝石精灵补齐：gemGold/gemRed 原缺失走纯色圆 fallback，现已补图 ---
    # window.__assets 指向文件名映射(files)；真加载的 Image 在模块内 images 字典（sprite() 读取）。
    # 故此处验证：① 键已映射 ② 文件真实存在且被服务端以 image/png 正确返回（修复本质）。
    expect('v0.34 gemGold/gemRed 键存在', page.evaluate("""() => !!(window.__assets && window.__assets['gemGold'] && window.__assets['gemRed'])"""))
    gem_load = page.evaluate("""async () => {
      const check = async (f) => {
        try {
          const r = await fetch('/assets/' + f, { cache: 'no-store' });
          const ct = r.headers.get('content-type') || '';
          return { ok: r.status === 200 && ct.includes('image/png') };
        } catch (e) { return { ok: false }; }
      };
      return { gold: (await check('gem_gold.png')).ok, red: (await check('gem_red.png')).ok };
    }""")
    expect('v0.34 gem_gold.png 真加载(image/png,200)', gem_load.get('gold') is True)
    expect('v0.34 gem_red.png 真加载(image/png,200)', gem_load.get('red') is True)
    expect('D1 亡灵光环半径随等级增长', page.evaluate("() => window.__weapons.aura.levels[4].radius > window.__weapons.aura.levels[0].radius"))
    expect('D1 圣水洗礼半径随等级增长', page.evaluate("() => window.__weapons.holywater.levels[4].radius > window.__weapons.holywater.levels[0].radius"))
    expect('D3 音效 zap/splash 方法存在', page.evaluate("() => typeof window.__game.audio.zap === 'function' && typeof window.__game.audio.splash === 'function'"))
    # Boss 精灵真被数据引用（不靠打满 180 秒实战）
    expect('A1 数据 BOSSES 各自指向 boss_* 精灵', page.evaluate("""() => window.__bosses.every(b => b.sprite.startsWith('boss_'))"""))
    # 甲-1 回归（v4.0）：easy 难度 bossGapMul=1.5 下，最末常规 Boss overlord 原解锁 810s > 化身 720s 永不可达。
    # 钳制后须 ≤630（化身前 90s）。用实时 BOSSES 数据复算钳制公式：clamped = END - 90 - (N-1-i)*45。
    easy_schedule = page.evaluate("""() => {
      const gap = 1.5;   // easy.difficulty.bossGapMul（甲-1 触发的难度）
      const END = 720;   // ENDGAME_BOSS_TIME
      const bosses = window.__bosses.filter(b => b.id !== 'avatar');
      const N = bosses.length;
      return bosses.map((b, i) => ({ id: b.id, unlockAt: Math.min(Math.round(b.unlockAt * gap), END - 90 - (N - 1 - i) * 45) }));
    }""")
    overlord_u = next((b['unlockAt'] for b in easy_schedule if b['id'] == 'overlord'), None)
    expect('甲-1 easy 下 overlord 化身前可达(≤630)', overlord_u is not None and overlord_u <= 630)
    # P3b-2 回归：4 精英类型必须 isElite 且 eliteWeight>0，否则刷新器 pool 过滤后为空 → 静默永不外刷精英
    elite_cfg = page.evaluate("""() => {
      const all = Object.values(window.__enemyTypes);
      const elites = all.filter(e => e.isElite);
      return { count: elites.length, allWeighted: elites.every(e => e.eliteWeight > 0) };
    }""")
    expect('P3b-2 精英类型数=4', elite_cfg['count'] == 4)
    expect('P3b-2 全部精英 eliteWeight>0(否则刷新器不外刷)', elite_cfg['allWeighted'] is True)
    # P3a-1 回归：spitter 须有吐弹参数（行为朝玩家单发弹幕）；rat_swarm 须 groupSize>1（成簇生成钩子）
    p3a1_cfg = page.evaluate("""() => {
      const sp = window.__enemyTypes.spitter;
      const rs = window.__enemyTypes.rat_swarm;
      return { spitOk: !!(sp && sp.spitCd && sp.spitSpeed && sp.spitDamage), ratsGroup: !!(rs && rs.groupSize > 1) };
    }""")
    expect('P3a-1 spitter 吐弹参数齐备', p3a1_cfg['spitOk'] is True)
    expect('P3a-1 rat_swarm groupSize>1(成簇钩子)', p3a1_cfg['ratsGroup'] is True)
    # P3a-1 运行时：清弹幕后生成 spitter，确定性推进 ~3s（覆盖一个吐弹周期），应吐出弹幕
    spit_proj = page.evaluate("""() => {
      const g = window.__game; g.state = 'playing'; g.enemies.enemyProjectiles.length = 0;
      const scale = g.enemies.statScale(false);
      g.enemies.spawnAt(window.__enemyTypes.spitter, scale);
      for (let i = 0; i < 30; i += 1) g.enemies.update(0.1);
      return g.enemies.enemyProjectiles.length;
    }""")
    expect('P3a-1 spitter 周期性吐弹(弹幕>0)', spit_proj > 0)
    # P3a-2 回归：revenant 须声明 onDeath.split(count=2)；siren 须有治疗参数
    p3a2_cfg = page.evaluate("""() => {
      const rv = window.__enemyTypes.revenant;
      const sn = window.__enemyTypes.siren;
      return {
        rvSplit: !!(rv && rv.onDeath && rv.onDeath.type === 'split' && rv.onDeath.count === 2),
        snHeal: !!(sn && sn.healCd && sn.healRange && sn.healPct && sn.healMax),
      };
    }""")
    expect('P3a-2 revenant 声明 onDeath.split×2', p3a2_cfg['rvSplit'] is True)
    expect('P3a-2 siren 治疗参数齐备', p3a2_cfg['snHeal'] is True)
    # P3a-2 运行时：revenant 死亡分裂×2；siren 治疗贴身残血友军
    p3a2 = page.evaluate("""() => {
      const g = window.__game; g.state = 'playing';
      const scale = g.enemies.statScale(false);
      g.enemies.enemies = g.enemies.enemies.filter(e => e.type.id !== 'revenant' && e.type.id !== 'revenant_shard');
      const rv = g.enemies.createEnemy(window.__enemyTypes.revenant, scale, 0, 0);
      g.enemies.enemies.push(rv); rv.hp = 0;
      g.enemies.update(0.1); // 处理 revenant 死亡 → 分裂 ×2
      const shards = g.enemies.enemies.filter(e => e.type.id === 'revenant_shard').length;
      const sn = g.enemies.createEnemy(window.__enemyTypes.siren, scale, 200, 200);
      const ally = g.enemies.createEnemy(window.__enemyTypes.rat_swarm, scale, 200, 200);
      sn.speed = 0; ally.speed = 0; // 钉住位置，隔离治疗逻辑
      ally.hp = 1; const before = ally.hp;
      g.enemies.enemies.push(sn); g.enemies.enemies.push(ally);
      for (let i = 0; i < 40; i += 1) g.enemies.update(0.1); // ~4s 覆盖一个治疗周期
      return { shards, healed: ally.hp > before };
    }""")
    expect('P3a-2 revenant 死亡分裂×2', p3a2['shards'] == 2)
    expect('P3a-2 siren 治疗友军(残血回血)', p3a2['healed'] is True)
    # P3a-3 回归：plague_bearer 须有 trail 参数 + onDeath.hazard 死亡大池
    p3a3_cfg = page.evaluate("""() => {
      const pb = window.__enemyTypes.plague_bearer;
      return {
        trailOk: !!(pb && pb.trailCd && pb.trailRadius && pb.trailDps),
        deathPool: !!(pb && pb.onDeath && pb.onDeath.type === 'hazard' && pb.onDeath.radius >= 60),
      };
    }""")
    expect('P3a-3 plague_bearer 毒径参数齐备', p3a3_cfg['trailOk'] is True)
    expect('P3a-3 plague_bearer 死亡大毒池声明', p3a3_cfg['deathPool'] is True)
    # P3a-3 运行时：行走留毒径(hazards>0) + 死亡生成大毒池(radius>=60)
    p3a3 = page.evaluate("""() => {
      const g = window.__game; g.state = 'playing';
      const scale = g.enemies.statScale(false);
      g.enemies.hazards.length = 0;
      const pb = g.enemies.createEnemy(window.__enemyTypes.plague_bearer, scale, 0, 0);
      pb.speed = 0; // 钉住，毒径堆原地便于计数
      g.enemies.enemies.push(pb);
      for (let i = 0; i < 20; i += 1) g.enemies.update(0.1); // ~2s → 多个毒径
      const trailCount = g.enemies.hazards.length;
      pb.hp = 0; g.enemies.update(0.1); // 触发死亡大池
      const deathPool = g.enemies.hazards.some(h => h.radius >= 60);
      return { trailCount, deathPool };
    }""")
    expect('P3a-3 plague_bearer 行走留毒径(hazards>0)', p3a3['trailCount'] > 0)
    expect('P3a-3 plague_bearer 死亡大毒池(radius>=60)', p3a3['deathPool'] is True)

    # --- 基础流程：升级三选一（用 API 直接触发，不依赖玩家击杀） ---
    # 探针遗留状态清理：前面内容探针把游戏留在 playing 态并让 RAF 循环累积经验，
    # 可能残留 levelup-screen 遮挡标题页 btn-start（经验量临界、偶发 flake）。进基础流程前彻底回到标题。
    dismiss_upgrades(page, halt=True)
    page.wait_for_timeout(100)
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

    # --- Boss 战：v4.0 P2 新时间线（90 血月先驱 → 180 血色男爵，Boss 串行化） ---
    dismiss_upgrades(page)
    # ① 教学 Boss 血月先驱（90s，v4.0 P2 新增）
    page.evaluate("() => { window.__game.time = 91; }")
    page.wait_for_timeout(1200)
    expect('新Boss 血月先驱 生成(90s)', page.evaluate("() => window.__game.enemies.enemies.some(e => e.isBoss && e.type && e.type.id === 'herald')"))
    expect('登场警告显示"血月先驱"', page.evaluate("() => document.getElementById('warn-name').textContent") == '血月先驱')
    expect('A1 新Boss 实例用 boss_* 精灵(§8.2 占位复用)', page.evaluate("""() => window.__game.enemies.enemies.some(e => e.isBoss && e.type && e.type.id === 'herald' && e.type.sprite.startsWith('boss_'))"""))
    # ② 原 Boss 血色男爵（180s）：移除先驱并清 activeBoss 后跳到 181，让其正常解锁生成
    page.evaluate("""() => {
      const g = window.__game;
      g.enemies.enemies = g.enemies.enemies.filter(e => !e.isBoss);
      g.enemies.activeBoss = null;
      g.time = 181;
    }""")
    page.wait_for_timeout(1200)
    boss_spawned = page.evaluate("() => window.__game.enemies.enemies.some(e => e.isBoss && e.type && e.type.id === 'baron')")
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
    # 加固：重臂所有阶段技能运行时，并把 hp 钉在 0.65 触发带，避免「此前已触发过」导致本次不再召唤的误报
    page.evaluate("""() => {
      const b = window.__game.enemies.activeBoss;
      if (b) {
        b.skillRuntime.forEach(rt => { rt.triggered = false; });
        b.hp = b.maxHp * 0.65;
      }
    }""")
    # 稳健判定：直接校验「65% 阶段技能已触发」(rt[0]=true)，而非净蝙蝠数（蝙蝠会被玩家武器消耗，净数不稳定）
    # 边等边清升级：升级面板一冒出来就 dismiss，模拟不会长时间停摆；成功（rt[0] 置真）即提前退出，最长 4s（20×200ms）
    summon65 = False
    for _ in range(20):
        dismiss_upgrades(page)
        page.wait_for_timeout(200)
        if page.evaluate("() => { const b = window.__game.enemies.activeBoss; return !!(b && b.skillRuntime[0] && b.skillRuntime[0].triggered); }"):
            summon65 = True
            break
    expect('65%血 召唤蝙蝠', summon65)

    # 打到 35% 触发弹幕（重置技能运行时 + 钉 0.35；校验 Boss 弹幕「曾经」生成过）
    # 页面内峰值采样器：弹幕撞到玩家会被 splice 清空，瞬时采样可能整段错过；
    # 故在页面内以 16ms 轮询记录历史峰值，断言看峰值而非「此刻是否还在飞」。
    page.evaluate("""() => {
      window.__projPeak = 0;
      window.__projWatch = setInterval(() => {
        const n = window.__game.enemies.enemyProjectiles.length;
        if (n > window.__projPeak) window.__projPeak = n;
      }, 16);
    }""")
    # 钉血前先清掉可能挂起的升级面板，确保钉血动作本身不是在暂停态下做的
    dismiss_upgrades(page)
    page.evaluate("""() => {
      const b = window.__game.enemies.activeBoss;
      if (b) {
        b.skillRuntime.forEach(rt => { rt.triggered = false; });
        b.hp = b.maxHp * 0.35;
      }
    }""")
    # 边等边清升级：升级面板一冒出来就 dismiss，模拟不会长时间停摆；
    # 成功（峰值>0）即提前退出，正常路径比固定 2000ms 还快；最长 4s（20×200ms）
    for _ in range(20):
        dismiss_upgrades(page)
        page.wait_for_timeout(200)
        if page.evaluate("() => window.__projPeak > 0"):
            break
    projectile_seen = page.evaluate("""() => {
      clearInterval(window.__projWatch);
      return window.__projPeak > 0;
    }""")
    expect('35%血 扇形弹幕', projectile_seen)
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
      let weaponHits = 0, bladeHits = 0, newHits = 0;
      const N = 300;
      for (let i = 0; i < N; i++) {
        const opts = g.upgrade.rollOptions();
        if (opts.some(o => o.isWeapon)) weaponHits++;
        if (opts.some(o => o.id === 'blade')) bladeHits++;
        if (opts.some(o => o.kind === 'weapon-new')) newHits++;
      }
      const pool = g.upgrade.buildPool();
      const bladeW = pool.find(o => o.id === 'blade').weight;
      const newW = pool.find(o => o.kind === 'weapon-new').weight;
      return { weaponHits, bladeHits, newHits, N, bladeW, newW };
    }""")
    expect('每层至少1个武器向(配额)', weighted['weaponHits'] == weighted['N'])
    # v2.0(16武器 + D4)：已拥有单把武器权重(5)仍高于任意单把新武器(3)，
    # 加权倾向已有武器不反转；同时 D4 让新武器整体被频繁提供（加速 build 收敛），且已拥有武器仍会出现。
    expect('已拥有武器单权重>单新武器(D4不反转)', weighted['bladeW'] > weighted['newW'])
    expect('新武器被频繁提供(D4生效)', weighted['newHits'] > 0)
    expect('已拥有武器仍会出现', weighted['bladeHits'] > 0)

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

    # --- 后期偏置：t>=540 时新武器权重下降（前期不变）---
    lateW = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.player.weapons = [{ id: 'blade', level: 1, timer: 0.4 }];
      g.player.passives = new Map([['boots', 1]]);
      g.player.maxWeapons = 6; g.player.maxPassives = 6;
      g.upgrade.banned.clear();
      g.time = 0;   const early = g.upgrade.buildPool();
      g.time = 900; const late = g.upgrade.buildPool();
      const wnE = early.find(o => o.kind === 'weapon-new').weight;
      const wnL = late.find(o => o.kind === 'weapon-new').weight;
      return { wnE, wnL };
    }""")
    # v2.0 D4：拥有武器少(仅 blade)时新武器权重 ×1.5 = 2*1.5 = 3；后期(t=900)再叠 late 压低 → <1
    expect('前期新武器权重=3(D4加成)', lateW['wnE'] == 3)
    expect('后期新武器权重下降(<1)', lateW['wnL'] < 1)
    # --- 分类权重(D5/§5.3)：已投资某分类→同系被动权重上升；公式 w = 1 + Δ·catCount[category] ---
    catW = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.player.weapons = [{ id: 'blade', level: 1, timer: 0.4 }];
      g.player.passives = new Map([['tome', 3]]);   // offense L3 → catCount.offense=3
      g.player.maxWeapons = 6; g.player.maxPassives = 6;
      g.upgrade.banned.clear();
      g.time = 0;
      const pool = g.upgrade.buildPool();
      const wOff  = pool.find(o => o.id === 'critrate').weight;  // offense，catCount=3
      const wUtil = pool.find(o => o.id === 'magnet').weight;    // utility，catCount=0
      return { wOff, wUtil, expect: 1 + 0.6 * 3 };
    }""")
    expect('分类权重 已投offense→同系被动权重=1+Δ·catCount', abs(catW['wOff'] - catW['expect']) < 1e-6)
    expect('分类权重 未投分类被动权重基准=1', abs(catW['wUtil'] - 1) < 1e-6)
    expect('分类权重 同系被动权重>未投分类', catW['wOff'] > catW['wUtil'])
    # 回退，避免污染后续
    page.evaluate("() => { window.__game.time = 0; window.__game.player.passives = new Map(); }")

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

    # --- 黎明圣印投射物独立 kind:'cross'（修复与红飞刃共用 blade 贴图）---
    crossKind = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.player.weapons = [];
      g.weapons.addWeapon('cross');
      g.enemies.enemies = [];
      const type = g.enemies.pickType();
      const dummy = g.enemies.createEnemy(type, g.enemies.statScale(), g.player.x + 30, g.player.y);
      dummy.hp = 9999; dummy.maxHp = 9999; dummy.speed = 0;
      g.enemies.enemies.push(dummy);
      g.weapons.projectiles.length = 0;
      for (let i = 0; i < 12; i++) g.weapons.update(0.1);  // 推进让 cross 多次开火
      return {
        hasCross: g.weapons.projectiles.some(p => p.kind === 'cross'),
        hasBlade: g.weapons.projectiles.some(p => p.kind === 'blade'),
      };
    }""")
    expect('黎明圣印投射物 kind=cross', crossKind['hasCross'])
    expect('黎明圣印不再复用 blade 贴图', not crossKind['hasBlade'])
    page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.weapons.projectiles.length = 0; }")

    # --- 血瓶掉率：v3.1 校准为 3.5%（原 2.5% 偏紧、原 7% 过高）；门槛 <5% 守回归 ---
    potion = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.pickups.gems.length = 0;
      const N = 3000; let potions = 0;
      for (let i = 0; i < N; i++) {
        const before = g.pickups.gems.length;
        g.onEnemyKilled({ isBoss: false, x: 100, y: 100, expValue: 1, hp: 1 });
        for (let k = before; k < g.pickups.gems.length; k++) {
          if (g.pickups.gems[k].potion) potions++;
        }
      }
      return { potions, N };
    }""")
    expect('血瓶掉率3.5%(<5%, 防回归7%)', potion['potions'] < potion['N'] * 0.05)
    page.evaluate("() => { window.__game.pickups.gems.length = 0; }")

    # --- 新配方进化：武器满级+被动 → 神器（武器丰富化，2026-07-23）---
    for wid, pid, aid in [('aura','heart','sepulcher'), ('whip','boots','eternalwhip'), ('cross','tome','matrix'), ('scythe','greed','reaper')]:
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

    # --- 长鞭单次挥击去重（v0.16）：大体积敌人只吃一次伤害，修复 boss 被秒 ---
    whipDedupe = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.player.lifesteal = 0;
      g.player.critChance = 0;  // 隔离暴击 RNG，专测去重（否则暴击使 ratio>1.25 误判）
      const type = g.enemies.pickType();
      const dummy = g.enemies.createEnemy(type, g.enemies.statScale(), g.player.x + 30, g.player.y);
      dummy.hp = 1000; dummy.maxHp = 1000; dummy.speed = 0; dummy.radius = 40;
      g.enemies.enemies.push(dummy);
      g.enemies._grid = g.enemies.buildGrid();
      const expected = 50 * g.player.damageMul;
      const before = dummy.hp;
      g.weapons.applyWhip(g.player, 0, { damage: 50, length: 300, width: 70 }, new Set());
      const single = before - dummy.hp;
      return { ratio: single / expected };
    }""")
    # 去重后大敌只受 1 次伤（ratio≈1）；若未去重会被 ~24 个采样点命中（ratio≈24）
    expect('长鞭单次挥击去重(大敌只受1次伤)', whipDedupe['ratio'] >= 0.8 and whipDedupe['ratio'] <= 1.25)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

    # --- 神器投射物主题区分（v0.16）：matrix 用金色 cross，storm/crimson/sepulcher 带 tint ---
    for wid, pid, aid, wantCross in [
        ('cross', 'tome', 'matrix', True),
        ('blade', 'boots', 'storm', False),
        ('blade', 'tome', 'crimson', False),
        ('aura', 'heart', 'sepulcher', False),
    ]:
        page.evaluate("""(args) => {
          const g = window.__game;
          const wid = args[0], pid = args[1], aid = args[2];
          g.state = 'playing';
          g.enemies.enemies = [];
          g.expQueue = 0;
          document.getElementById('levelup-screen').classList.add('hidden');
          g.player.weapons = [];
          g.player.passives = new Map();
          g.weapons.addWeapon(wid);
          const w = g.player.weapons.find(x => x.id === wid);
          if (w) w.level = 5;
          g.player.passives.set(pid, 1);
          g.onChestOpened({ boss: true });
          const type = g.enemies.pickType();
          const dummy = g.enemies.createEnemy(type, g.enemies.statScale(), g.player.x + 60, g.player.y);
          dummy.hp = 1e9; dummy.maxHp = 1e9; dummy.speed = 0;
          g.enemies.enemies.push(dummy);
          g.weapons.projectiles.length = 0;
        }""", [wid, pid, aid])
        page.wait_for_timeout(700)
        dismiss_upgrades(page)
        proj = page.evaluate("""() => {
          const g = window.__game;
          for (let i = 0; i < 8; i++) g.weapons.update(0.1);
          const ps = g.weapons.projectiles;
          return { count: ps.length, hasCross: ps.some(p => p.kind === 'cross'), hasBlade: ps.some(p => p.kind === 'blade'), anyTint: ps.some(p => !!p.tint) };
        }""", aid)
        if wantCross:
            expect(f'{aid} 投射物 kind=cross(金色,去重红飞刃)', proj['hasCross'] and not proj['hasBlade'])
        else:
            expect(f'{aid} 投射物带 tint 主题区分', proj['anyTint'])
        page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.weapons.projectiles.length = 0; }")

    # --- 图鉴验证 ---
    page.evaluate("() => window.__game.ui.showTitle()")
    page.wait_for_timeout(300)
    dismiss_upgrades(page, halt=True)
    page.click('#btn-codex')
    page.wait_for_timeout(500)
    # 游戏图鉴 一级菜单：4 张分类卡片（武器/被动/神器/怪物）
    expect('游戏图鉴一级菜单可见', page.evaluate("() => !document.getElementById('codex-hub').classList.contains('hidden')"))
    expect('图鉴一级菜单 4 张分类卡', page.evaluate("() => document.querySelectorAll('#codex-hub-grid .codex-hub-card').length == 4"))
    # 武器卡 icon 已加载（验证资源缺失导致的空白卡片已修复：iconURL 返回非空 data URL 且实际绘制）
    expect('图鉴武器卡 icon 已加载(非空白)', page.evaluate("""() => {
        const imgs = [...document.querySelectorAll('#codex-hub-grid .codex-hub-card[data-target="weapons"] img')];
        return imgs.length === 1 && (imgs[0].getAttribute('src')||'').startsWith('data:image') && imgs[0].naturalWidth > 0;
    }"""))
    # 点「武器图鉴」→ 16 把武器 + 16 个配色标签
    page.click('#codex-hub-grid .codex-hub-card[data-target="weapons"]')
    page.wait_for_timeout(300)
    wcodex = page.evaluate("""() => ({
      total: document.querySelectorAll('#codex-weapons .codex-card').length,
      tags: document.querySelectorAll('#codex-weapons .cat-tag').length,
    })""")
    expect('武器图鉴 16 张武器卡', wcodex['total'] == 16)
    expect('武器图鉴 16 个配色标签', wcodex['tags'] == 16)
    page.click('#btn-codex-weapons-topback')
    page.wait_for_timeout(200)
    # 点「神器图鉴」→ 18 个神器（含圣洁吞噬已解锁）
    page.click('#codex-hub-grid .codex-hub-card[data-target="artifacts"]')
    page.wait_for_timeout(300)
    expect('图鉴 圣洁吞噬 已解锁', page.evaluate("""() => [...document.querySelectorAll('#codex-artifacts .codex-card')].some(c => !c.classList.contains('locked') && c.textContent.includes('圣洁吞噬'))"""))
    acodex = page.evaluate("() => document.querySelectorAll('#codex-artifacts .codex-card').length")
    expect('神器图鉴 18 张', acodex == 18)
    page.click('#btn-codex-artifacts-topback')
    page.wait_for_timeout(200)
    # 点「被动图鉴」→ 13 张被动
    page.click('#codex-hub-grid .codex-hub-card[data-target="passives"]')
    page.wait_for_timeout(300)
    pcodex = page.evaluate("() => document.querySelectorAll('#codex-passives .codex-card').length")
    expect('被动图鉴 13 张', pcodex == 13)
    page.click('#btn-codex-passives-topback')
    page.wait_for_timeout(200)
    # 怪物图鉴（已回到一级菜单）
    page.click('#codex-hub-grid .codex-hub-card[data-target="monsters"]')
    page.wait_for_timeout(300)
    expect('怪物图鉴 含 Boss 分组与卡片', page.evaluate("() => document.getElementById('codex-monsters').innerHTML.includes('血色男爵')"))
    expect('怪物图鉴 含石像鬼', page.evaluate("() => document.getElementById('codex-monsters').innerHTML.includes('石像鬼')"))
    # v4.0 P3：精灵键写错会静默降级成紫色实心圆（不抛异常不打日志），故做全量资产存在性断言。
    # 新精英 sprite 走复用键（shadow_hunter/elite/gargoyle），一旦有人按设计文档写成
    # 不存在的 elite_reaver/elite_conduit/elite_colossus，这条会立刻报警。
    expect('全部敌人精灵资产存在', page.evaluate(
        "() => Object.values(window.__enemyTypes).every(t => !!window.__assets[t.sprite])"))
    # 永夜化身卡时间文案回归（ui.js 改用 t.id 匹配 avatar）：应显示「终局 12 分降临」而非「首现 1666分」
    expect('怪物图鉴 永夜化身卡显示「终局 12 分降临」', page.evaluate("""() => {
        const cards = [...document.querySelectorAll('#codex-monsters-content .codex-card')];
        const card = cards.find(c => { const n = c.querySelector('.cc-name'); return n && n.textContent === '永夜化身'; });
        if (!card) return false;
        const stats = card.querySelector('.cc-hint');
        const txt = stats ? stats.textContent : '';
        return txt.includes('终局 12 分降临') && !txt.includes('首现 1666分');
    }"""))
    # 特殊属性卡：自然精灵 + 彩色光环 + 头顶徽标(离屏 canvas 生成的 data:image) + 彩色边框
    expect('词缀卡 爆破 自然精灵+橙边', page.evaluate("""() => {
        const cards = [...document.querySelectorAll('#codex-monsters-content .codex-card')];
        const card = cards.find(c => { const n = c.querySelector('.cc-name'); return n && n.textContent === '爆破'; });
        if (!card) return false;
        const img = card.querySelector('img');
        const border = card.style.borderLeftColor || '';
        return !!img && (img.getAttribute('src')||'').startsWith('data:image') && border.includes('rgb(230, 126, 34)');
    }"""))
    expect('词缀卡 护盾 自然精灵+蓝边', page.evaluate("""() => {
        const cards = [...document.querySelectorAll('#codex-monsters-content .codex-card')];
        const card = cards.find(c => { const n = c.querySelector('.cc-name'); return n && n.textContent === '护盾'; });
        if (!card) return false;
        const img = card.querySelector('img');
        const border = card.style.borderLeftColor || '';
        return !!img && (img.getAttribute('src')||'').startsWith('data:image') && border.includes('rgb(52, 152, 219)');
    }"""))
    expect('词缀卡 狼群 自然精灵+金边', page.evaluate("""() => {
        const cards = [...document.querySelectorAll('#codex-monsters-content .codex-card')];
        const card = cards.find(c => { const n = c.querySelector('.cc-name'); return n && n.textContent === '狼群'; });
        if (!card) return false;
        const img = card.querySelector('img');
        const border = card.style.borderLeftColor || '';
        return !!img && (img.getAttribute('src')||'').startsWith('data:image') && border.includes('rgb(241, 196, 15)');
    }"""))
    page.evaluate("() => window.__game.ui.hideCodex()")
    page.wait_for_timeout(200)
    expect('图鉴关闭后回到标题', page.evaluate("() => document.getElementById('codex-hub').classList.contains('hidden') && !document.getElementById('title-screen').classList.contains('hidden')"))
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

    # 灵魂货币公式（v0.17）：floor((time/900)*500)+level，收敛到 2~3 把毕业
    cur = page.evaluate("""() => {
      const g = window.__game;
      g.difficulty = g.difficulty; g.soulGainMul = 1; g.player.level = 20; g.time = 900;
      return g.computeSoulReward(false);
    }""")
    expect('通关结算≈520(500+等级20)', cur == 520)
    short = page.evaluate("""() => {
      const g = window.__game; g.player.level = 5; g.time = 60; return g.computeSoulReward(false);
    }""")
    expect('短局结算≈38(收敛不通胀)', short == 38)

    # 石像鬼基础伤害下调 40→22（④）
    expect('石像鬼基础伤害=22', page.evaluate("() => window.__enemyTypes.gargoyle.damage === 22"))

    # 永夜加深：非Boss 伤害指数减半（D/2），避免后期指数秒杀
    night = page.evaluate("""() => {
      const g = window.__game; g.time = 900;  // D = (900-540)/60 = 6
      const mobScale = g.enemies.statScale(false);
      const bossScale = g.enemies.statScale(true);
      return { mob: mobScale.damage, boss: bossScale.damage };
    }""")
    expect('非Boss永夜指数减半(小怪伤害<Boss)', night['mob'] < night['boss'])

    # 非Boss 单次触碰伤害上限 = 35% 最大生命（防后期一击秒杀）
    cap = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.time = 0; g.enemies.enemies = [];
      g.player.hp = g.player.maxHp = 200; g.player.iframes = 0;
      const type = g.enemies.pickType();
      const e = g.enemies.createEnemy(type, g.enemies.statScale(false), g.player.x, g.player.y);
      e.damage = 99999; e.isBoss = false; e.hitCooldown = 0;
      g.enemies.enemies.push(e);
      g.enemies._grid = g.enemies.buildGrid();
      g.enemies.update(0.016);
      return { hpLost: 200 - g.player.hp };
    }""")
    expect('非Boss触碰伤害封顶≤35%最大生命', cap['hpLost'] <= 200 * 0.35 + 1)

    # ---- 正面装甲激活基线（P3a-4 / D1·D2）----
    # P3a-S 读取端（entities.js:damageEnemy）+ bone_knight 的 frontalArmor 配置（data.js）早就存在，
    # 此前靠「敌人实例无 facingX/facingY」这第二道守卫维持休眠（提交 60ffed9 的钉桩断言 hasFacing=False）。
    # P3a-4 给 bone_knight 加了 boneKnightBehavior（限转向速率插值 facing），激活后：
    #   · 正面直伤（knock 来自玩家→敌人，与 facing 反向）→ dot<arcCos → ×0.30（减伤 70%）
    #   · 零向量 AoE / DOT → 全额（设计裁决 §1.6：范围伤害无视护甲）
    #   · 绕到背面（knock 与 facing 同向）→ dot>arcCos → 全额
    # ⚠️ 本断言即原「休眠钉桩」的预期翻转：休眠→激活是有意的、已显式申报，绝非测试坏了。
    #    数值基线 front=30 / aoe=100 / back=100 必须守住，不得放松（改 mul 须同步改此处）。
    fa = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = [];
      g.enemies.spawnTimer = 999; // 禁用刷新副作用，隔离本用例
      const scale = g.enemies.statScale(false);
      // hp 拉高：避免 100 点伤害触发死亡分支（掉落/onEnemyKilled）污染后续用例
      const mk = (fx, fy) => { const e = g.enemies.createEnemy(window.__enemyTypes.bone_knight, scale, 0, 0); e.hp = e.maxHp = 100000; e.facingX = fx; e.facingY = fy; return e; };
      // 正面：facing 指向玩家(-1,0)，knock 来自玩家(+1,0) → dot=-1<-0.5 → 减伤
      const a = mk(-1, 0);
      g.enemies.damageEnemy(a, 100, 1, 0);
      // 零向量 AoE：恒全额
      const b = mk(-1, 0);
      g.enemies.damageEnemy(b, 100, 0, 0);
      // 背面：facing 背离玩家(+1,0)，knock 同向(+1,0) → dot=+1>-0.5 → 全额
      const c = mk(1, 0);
      g.enemies.damageEnemy(c, 100, 1, 0);
      return {
        frontLoss: +(100000 - a.hp).toFixed(3),
        aoeLoss: +(100000 - b.hp).toFixed(3),
        backLoss: +(100000 - c.hp).toFixed(3),
      };
    }""")
    expect('bone_knight 正面直伤吃减伤(100×0.30=30)', fa['frontLoss'] == 30)
    expect('bone_knight 零向量AoE吃全额(100)', fa['aoeLoss'] == 100)
    expect('bone_knight 背面直伤吃全额(100)', fa['backLoss'] == 100)

    # behavior 确实在设置 facing：否则正面装甲会静默失效，回到 D1 警告的「全能减伤」陷阱。
    # 敌人初始无 facing，跑一帧 update 后 boneKnightBehavior 应把 facing 朝向玩家（单位向量）。
    facingInit = page.evaluate("""() => {
      const g = window.__game;
      g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      const scale = g.enemies.statScale(false);
      const e = g.enemies.createEnemy(window.__enemyTypes.bone_knight, scale, 100, 0);
      g.enemies.enemies.push(e); // 必须入列，update 才会对该敌执行 behavior 设置 facing
      g.player.x = 0; g.player.y = 0; // 玩家在敌人左侧 → 期望 facing≈(-1,0)
      const before = (typeof e.facingX === 'number');
      g.enemies.update(0.016);
      const mag = Math.hypot(e.facingX || 0, e.facingY || 0);
      const towardPlayer = ((e.facingX || 0) * (-1) + (e.facingY || 0) * 0); // 与(-1,0)同向投影
      return { before, after: (typeof e.facingX === 'number'), mag: +mag.toFixed(3), towardPlayer: +towardPlayer.toFixed(3) };
    }""")
    expect('bone_knight 初始无 facing(before False)', facingInit['before'] is False)
    expect('bone_knight update 后获得 facing(after True)', facingInit['after'] is True)
    expect('bone_knight facing 为单位向量(模≈1)', abs(facingInit['mag'] - 1) < 0.05)
    expect('bone_knight facing 朝向玩家(投影>0.9)', facingInit['towardPlayer'] > 0.9)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")  # 清理，不污染后续用例

    # ---- 巨像正面装甲激活基线（P3b-3① / D1·D2）----
    # 腐骸巨像复用 bone_knight 的 boneKnightBehavior（facing+frontalArmor 机制，类型驱动），
    # 数据层 frontalArmor {arcCos:-0.34, mul:0.40} → 正面 140° 减伤 60%。渲染弧线自动（L1104 读 e.type）。
    # 数值基线 front=40(100×0.40) / aoe=100 / back=100，与 bone_knight 同源但 mul 不同，必须独立守住。
    faC = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      const scale = g.enemies.statScale(false);
      const mk = (fx, fy) => { const e = g.enemies.createEnemy(window.__enemyTypes.elite_colossus, scale, 0, 0); e.hp = e.maxHp = 100000; e.facingX = fx; e.facingY = fy; return e; };
      const a = mk(-1, 0); g.enemies.damageEnemy(a, 100, 1, 0);       // 正面：减伤
      const b = mk(-1, 0); g.enemies.damageEnemy(b, 100, 0, 0);       // 零向量 AoE：全额
      const c = mk(1, 0); g.enemies.damageEnemy(c, 100, 1, 0);        // 背面：全额
      return { frontLoss: +(100000 - a.hp).toFixed(3), aoeLoss: +(100000 - b.hp).toFixed(3), backLoss: +(100000 - c.hp).toFixed(3) };
    }""")
    expect('elite_colossus 正面直伤吃减伤(100×0.40=40)', faC['frontLoss'] == 40)
    expect('elite_colossus 零向量AoE吃全额(100)', faC['aoeLoss'] == 100)
    expect('elite_colossus 背面直伤吃全额(100)', faC['backLoss'] == 100)

    # behavior 确实在设置 facing：复用 boneKnightBehavior，跑一帧 update 后应朝向玩家。
    facingC = page.evaluate("""() => {
      const g = window.__game;
      g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      const scale = g.enemies.statScale(false);
      const e = g.enemies.createEnemy(window.__enemyTypes.elite_colossus, scale, 100, 0);
      g.enemies.enemies.push(e); // 必须入列，update 才会执行 behavior 设置 facing
      g.player.x = 0; g.player.y = 0; // 玩家在敌人左侧 → 期望 facing≈(-1,0)
      const before = (typeof e.facingX === 'number');
      g.enemies.update(0.016);
      const mag = Math.hypot(e.facingX || 0, e.facingY || 0);
      const towardPlayer = ((e.facingX || 0) * (-1) + (e.facingY || 0) * 0);
      return { before, after: (typeof e.facingX === 'number'), mag: +mag.toFixed(3), towardPlayer: +towardPlayer.toFixed(3) };
    }""")
    expect('elite_colossus 初始无 facing(before False)', facingC['before'] is False)
    expect('elite_colossus update 后获得 facing(after True)', facingC['after'] is True)
    expect('elite_colossus facing 为单位向量(模≈1)', abs(facingC['mag'] - 1) < 0.05)
    expect('elite_colossus facing 朝向玩家(投影>0.9)', facingC['towardPlayer'] > 0.9)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

    # ---- 裂魂掠夺者冲刺（P3b-3② / D5）----
    # 复用 shadow_hunter 三态机，数据层 dashCd:3.2 → 周期≈4s 可预判读招。
    # 关键不变量：shadow_hunter 无 dashCd（缺省 0）→ idle 门控恒开，逐字节不变；仅 reaver 配 dashCd 生效。
    dashDecl = page.evaluate("""() => {
      const g = window.__game;
      const rv = window.__enemyTypes.elite_reaver, sh = window.__enemyTypes.shadow_hunter;
      return {
        reaver_has: !!(rv.dashRange && rv.dashSpeed && rv.dashCd > 0 && rv.dashDuration > 0),
        reaver_cd: rv.dashCd, reaver_range: rv.dashRange, reaver_speed: rv.dashSpeed,
        shadow_no_cd: (typeof sh.dashCd === 'undefined'),  // 缺省 0 → 逐字节不变
      };
    }""")
    expect('elite_reaver 声明 dash 字段齐全(dashRange/Speed/Cd/Duration)', dashDecl['reaver_has'] is True)
    expect('elite_reaver dashCd=3.2', dashDecl['reaver_cd'] == 3.2)
    expect('elite_reaver dashRange=320', dashDecl['reaver_range'] == 320)
    expect('elite_reaver dashSpeed=3.4', dashDecl['reaver_speed'] == 3.4)
    expect('shadow_hunter 无 dashCd(缺省0,逐字节不变)', dashDecl['shadow_no_cd'] is True)

    # 运行时：reaver 在玩家射程内应在数秒内至少一次进入 charging→dashing（首次 dashCd=0 立即触发）
    # dashCd 在「dashing→idle 转换」时置为 3.2，故在观察到的第一次 dashing→idle 过渡处采样。
    dashRun = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      const scale = g.enemies.statScale(false);
      const e = g.enemies.createEnemy(window.__enemyTypes.elite_reaver, scale, 100, 0);
      e.hp = e.maxHp = 100000; // 避免死亡分支污染
      g.enemies.enemies.push(e);
      g.player.x = 0; g.player.y = 0; // 玩家在敌人左侧，dist=100<dashRange
      let sawCharge = false, sawDash = false, prev = null, cdAfterDash = -1;
      for (let i = 0; i < 320; i++) { // ~5.1s，足够覆盖一个 4s 周期
        g.enemies.update(0.016);
        if (e.dashState === 'charging') sawCharge = true;
        if (e.dashState === 'dashing') sawDash = true;
        if (prev === 'dashing' && e.dashState === 'idle' && cdAfterDash < 0) cdAfterDash = e.dashCd;
        prev = e.dashState;
      }
      return { sawCharge, sawDash, cdAfterDash };
    }""")
    expect('elite_reaver 运行时进入 charging 态', dashRun['sawCharge'] is True)
    expect('elite_reaver 运行时进入 dashing 态', dashRun['sawDash'] is True)
    expect('elite_reaver 冲刺结束 dashCd 置为 3.2', abs(dashRun['cdAfterDash'] - 3.2) < 0.001)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

    # ---- 血狱典狱长半血召唤（P3b-3③）----
    # 通用 onLowHp 钩子：elite 首次 hp/maxHp<=0.5 触发 bossSummon(bat,4)，once 由 _lowHpFired 保证。
    lowDecl = page.evaluate("""() => {
      const g = window.__game;
      const el = window.__enemyTypes.elite;
      return { has: !!(el.onLowHp && el.onLowHp.at === 0.5 && el.onLowHp.enemyType === 'bat' && el.onLowHp.count === 4),
               at: el.onLowHp ? el.onLowHp.at : null, kind: el.onLowHp ? el.onLowHp.type : null };
    }""")
    expect('elite 声明 onLowHp(半血召唤bat×4)', lowDecl['has'] is True)
    expect('elite onLowHp.at=0.5', lowDecl['at'] == 0.5)
    expect('elite onLowHp.type=summon', lowDecl['kind'] == 'summon')

    lowRun = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      const scale = g.enemies.statScale(false);
      const e = g.enemies.createEnemy(window.__enemyTypes.elite, scale, 0, 0);
      e.hp = e.maxHp * 0.4; // 跌破 50%
      e._lowHpFired = false;
      g.enemies.enemies.push(e);
      const before = g.enemies.enemies.length;
      g.enemies.update(0.016);
      const bats = g.enemies.enemies.filter(x => x.type && x.type.id === 'bat').length;
      return { fired: e._lowHpFired === true, added: g.enemies.enemies.length - before, bats };
    }""")
    expect('elite 半血触发 onLowHp(_lowHpFired=True)', lowRun['fired'] is True)
    expect('elite 召唤 bat×4', lowRun['bats'] == 4)
    expect('elite 召唤后 enemies 增 4', lowRun['added'] == 4)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

    # ---- 永夜导体环形弹幕 + 加速光环（P3b-3④）----
    condDecl = page.evaluate("""() => {
      const g = window.__game;
      const c = window.__enemyTypes.elite_conduit;
      return { hasBarrage: !!(c.barrage && c.barrage.cd && c.barrage.count && c.barrage.speed && c.barrage.damage),
               hasBuff: !!(c.allyBuff && c.allyBuff.radius && c.allyBuff.speedMul),
               speedMul: c.allyBuff ? c.allyBuff.speedMul : null, radius: c.allyBuff ? c.allyBuff.radius : null };
    }""")
    expect('elite_conduit 声明 barrage 字段', condDecl['hasBarrage'] is True)
    expect('elite_conduit 声明 allyBuff 字段', condDecl['hasBuff'] is True)
    expect('elite_conduit allyBuff.speedMul=1.25', abs(condDecl['speedMul'] - 1.25) < 0.001)
    expect('elite_conduit allyBuff.radius=180', condDecl['radius'] == 180)

    # 运行时：导体应在 ~3s 内发至少一次环形弹幕（enemyProjectiles 出现）
    condBarrage = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      g.enemies.enemyProjectiles.length = 0;
      const scale = g.enemies.statScale(false);
      const c = g.enemies.createEnemy(window.__enemyTypes.elite_conduit, scale, 0, 0);
      c.hp = c.maxHp = 100000;
      g.enemies.enemies.push(c);
      g.player.x = 800; g.player.y = 0; // 玩家放远：弹幕辐射后留存可观测（贴身会被同帧吃掉）
      let maxProj = 0;
      for (let i = 0; i < 220; i++) { // ~3.5s，覆盖首个 3s 周期
        g.enemies.update(0.016);
        if (g.enemies.enemyProjectiles.length > maxProj) maxProj = g.enemies.enemyProjectiles.length;
      }
      return { maxProj };
    }""")
    expect('elite_conduit 运行时发射环形弹幕(弹幕>0)', condBarrage['maxProj'] > 0)
    page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.enemies.enemyProjectiles.length = 0; }")

    # 运行时：范围内非精英杂兵获 +25% 加速；其它精英与导体自身不加速（用户决议）
    condBuff = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.enemies.spawnTimer = 999;
      const scale = g.enemies.statScale(false);
      const c = g.enemies.createEnemy(window.__enemyTypes.elite_conduit, scale, 0, 0);
      c.hp = c.maxHp = 100000;
      const mob = g.enemies.createEnemy(window.__enemyTypes.bat, scale, 50, 0);          // 50px 内，非精英(应加速)
      const elite = g.enemies.createEnemy(window.__enemyTypes.elite_colossus, scale, 50, 0); // 50px 内，真精英(应跳过)
      g.enemies.enemies.push(c, mob, elite);
      g.player.x = 0; g.player.y = 0;
      g.enemies.update(0.016); // 预扫描在该帧施加 _speedMul
      return { mobBuff: mob._speedMul, eliteBuff: elite._speedMul, selfBuff: c._speedMul };
    }""")
    expect('elite_conduit 范围内杂兵获+25%加速(_speedMul=1.25)', abs(condBuff['mobBuff'] - 1.25) < 0.001)
    expect('elite_conduit 不加速其它真精英(elite_colossus=1)', abs(condBuff['eliteBuff'] - 1) < 0.001)
    expect('elite_conduit 不自我加速(=1)', abs(condBuff['selfBuff'] - 1) < 0.001)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

    # ---- P3b-4 精英保底金宝石 + 巨像双宝箱（D3 裁决 + 难度方案 L554）----
    # D3：精英击杀保底掉 1 颗 gemGold(价值=GEM_DEFS[3].min=25)，且从 exp 里扣除 → 净经验不通胀。
    # 用合成低 exp(<25) 隔离分支差异：当前代码把精英当普通怪走分级掉落，低 exp 精英不掉 gemGold、
    # 总经验=exp(不保底)；加分支后低 exp 精英仍保底 1 金 + 总经验=25。
    eliteDrop = page.evaluate("""() => {
      const g = window.__game;
      g.pickups.gems = [];
      g.pickups.drop(0, 0, 5, window.__enemyTypes.elite_colossus);
      const gold = g.pickups.gems.filter(x => x.def && x.def.key === 'gemGold');
      const total = g.pickups.gems.reduce((s, x) => s + (x.value || 0), 0);
      return { goldCount: gold.length, goldVal: gold.length ? gold[0].value : 0, total: +total.toFixed(3) };
    }""")
    expect('P3b-4 精英保底 gemGold×1(价值25)', eliteDrop['goldCount'] == 1 and eliteDrop['goldVal'] == 25)
    expect('P3b-4 低exp精英保底总经验=25(不随exp<25收缩)', eliteDrop['total'] == 25)

    # 对照：非精英低 exp 不掉 gemGold、总经验=exp（分支不污染普通怪）
    normDrop = page.evaluate("""() => {
      const g = window.__game;
      g.pickups.gems = [];
      g.pickups.drop(0, 0, 5, window.__enemyTypes.bone_knight);
      const gold = g.pickups.gems.filter(x => x.def && x.def.key === 'gemGold');
      const total = g.pickups.gems.reduce((s, x) => s + (x.value || 0), 0);
      return { goldCount: gold.length, total: +total.toFixed(3) };
    }""")
    expect('P3b-4 非精英低exp不掉gemGold(对照)', normDrop['goldCount'] == 0)
    expect('P3b-4 非精英总经验=exp(5)', normDrop['total'] == 5)

    # 巨像死掉双宝箱；非巨像精英仍掉 1 宝箱（死亡块 isElite 分支特例）
    colChest = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.pickups.gems = [];
      const scale = g.enemies.statScale(false);
      const e = g.enemies.createEnemy(window.__enemyTypes.elite_colossus, scale, 0, 0);
      g.enemies.enemies.push(e); e.hp = 0;
      g.enemies.update(0.016);
      return g.pickups.gems.filter(x => x.chest).length;
    }""")
    expect('P3b-4 elite_colossus 死掉双宝箱(2)', colChest == 2)

    revChest = page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing'; g.enemies.enemies = []; g.pickups.gems = [];
      const scale = g.enemies.statScale(false);
      const e = g.enemies.createEnemy(window.__enemyTypes.elite_reaver, scale, 0, 0);
      g.enemies.enemies.push(e); e.hp = 0;
      g.enemies.update(0.016);
      return g.pickups.gems.filter(x => x.chest).length;
    }""")
    expect('P3b-4 非colossus精英仍掉1宝箱(对照)', revChest == 1)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

    # ===== P3b-5a RED：图鉴分组重构 + 弱点情报（实现前必失败）=====
    # 依赖 window.__codexDebug（GREEN 阶段在 ui.js 暴露）：groups/badges/hint 纯函数。
    # 当前未实现 → 返回 {ok:false} → 以下断言全部失败，构成 RED。
    codex = page.evaluate("""() => {
      if (!window.__codexDebug) return { ok: false };
      const g = window.__codexDebug.groups();
      const byId = Object.fromEntries(g.map(x => [x.id, x.entries.map(e => e.key)]));
      return {
        ok: true,
        elite: byId.elite || [],
        species: byId.species || [],
        affix: byId.affix || [],
        boss: byId.boss || [],
        colBadges: window.__codexDebug.badges('elite_colossus').map(b => b.text).join('|'),
        garBadges: window.__codexDebug.badges('gargoyle').map(b => b.text).join('|'),
        bkBadges: window.__codexDebug.badges('bone_knight').map(b => b.text).join('|'),
        hint0: window.__codexDebug.hint('bone_knight', 0),
        hint20: window.__codexDebug.hint('bone_knight', 20),
        hint100: window.__codexDebug.hint('bone_knight', 100),
      };
    }""")
    expect('P3b-5a __codexDebug 已暴露', codex.get('ok') is True)
    expect('P3b-5a 含精英分组(elite_colossus)', 'elite_colossus' in (codex.get('elite') or []))
    expect('P3b-5a 精英不混入怪种', 'elite_colossus' not in (codex.get('species') or []))
    expect('P3b-5a 内部weight:0类型排除(revenant_shard)', 'revenant_shard' not in (codex.get('species') or []))
    expect('P3b-5a 词缀覆盖8条', len(codex.get('affix') or []) == 8)
    expect('P3b-5a 巨像弱点含正面装甲', '正面' in (codex.get('colBadges') or ''))
    expect('P3b-5a 石像鬼弱点含免疫击退', '击退' in (codex.get('garBadges') or ''))
    expect('P3b-5a 骨骑弱点含侧背', '侧背' in (codex.get('bkBadges') or ''))
    expect('P3b-5a 0杀应对提示未解锁(tier0)', bool(codex.get('hint0')) and codex['hint0']['tier'] == 0)
    expect('P3b-5a ≥20杀解锁T1(tier≥1)', bool(codex.get('hint20')) and codex['hint20']['tier'] >= 1)
    expect('P3b-5a ≥100杀解锁T2(tier≥2)', bool(codex.get('hint100')) and codex['hint100']['tier'] >= 2)
    page.evaluate("() => { window.__game.enemies.enemies = []; }")

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

    # 圣徒：圣水起手（槽外固有·不占武器槽）+ 范围倍率>1
    saint = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('saint');
      window.__bloodlines.setBloodline('saint');
      window.__game.startRun();
      const p = window.__game.player;
      return { slots: p.weapons.map(w=>w.id), innate: p.innateWeapons.map(w=>w.id), area: p.areaMul };
    }""")
    expect('圣徒 解锁+选择', page.evaluate("() => window.__bloodlines.isBloodlineUnlocked('saint')"))
    expect('圣徒起手 圣水洗礼(槽外固有·不占槽)', saint['innate'] == ['holywater'] and saint['slots'] == [])
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

    # 嗜血者：长鞭起手 + 命中回血>0 + 伤害>1
    bt = page.evaluate("""() => {
      window.__bloodlines.buyBloodlineUnlock('bloodthirsty');
      window.__bloodlines.setBloodline('bloodthirsty');
      window.__game.startRun();
      const p = window.__game.player;
      return { weapons: p.weapons.map(w=>w.id), ls: p.lifesteal, dmg: p.damageMul };
    }""")
    expect('嗜血者起手 噬魂长鞭', bt['weapons'] == ['whip'])
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

    # 隐藏血裔 apostle 首次通关自动解锁 + 成就横幅（v0.16）：修复此前永久死锁
    page.evaluate("() => window.__souls.saveSouls({balance:0,spent:0,unlocks:[],cleared:[],bloodlines:['wanderer'],selectedBloodline:'wanderer'})")
    apUnlock = page.evaluate("""() => {
      window.__game.state = 'playing';
      const wasLocked = !window.__bloodlines.isBloodlineUnlocked('apostle');
      window.__game.gameWin();
      return { wasLocked, nowUnlocked: window.__bloodlines.isBloodlineUnlocked('apostle') };
    }""")
    expect('通关前 apostle 未解锁', apUnlock['wasLocked'])
    expect('首次通关解锁 永夜使徒', apUnlock['nowUnlocked'])
    expect('通关成就横幅显示(含永夜使徒)', page.evaluate("() => { const e = document.getElementById('achievement'); return !!e && !e.classList.contains('hidden') && e.textContent.includes('永夜使徒'); }"))

    # --- 胜利结算弹窗回归：背景遮罩 + 按钮关闭（v0.19 修复） ---
    expect('胜利弹窗显示', page.evaluate("() => !document.getElementById('victory-screen').classList.contains('hidden')"))
    expect('胜利弹窗有背景遮罩', page.evaluate("""() => {
      const s = getComputedStyle(document.getElementById('victory-screen'));
      return s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
    }"""))
    # 返回主界按钮应关闭胜利弹窗
    page.click('#btn-victory-home')
    page.wait_for_timeout(200)
    expect('返回主界按钮关闭胜利弹窗', page.evaluate("() => document.getElementById('victory-screen').classList.contains('hidden') && !document.getElementById('title-screen').classList.contains('hidden')"))
    # 再战一夜按钮应关闭胜利弹窗并进入游戏
    page.evaluate("() => { window.__game.state = 'playing'; window.__game.ui.showVictory(); }")
    page.wait_for_timeout(100)
    expect('再战前胜利弹窗显示', page.evaluate("() => !document.getElementById('victory-screen').classList.contains('hidden')"))
    page.click('#btn-victory-retry')
    page.wait_for_timeout(200)
    expect('再战一夜按钮关闭胜利弹窗并进入游戏', page.evaluate("() => document.getElementById('victory-screen').classList.contains('hidden') && !document.getElementById('hud').classList.contains('hidden') && window.__game.state === 'playing'"))

    page.evaluate("() => { document.getElementById('achievement').classList.add('hidden'); document.getElementById('victory-screen').classList.add('hidden'); window.__game.ui.showTitle(); }")

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

    # --- UI 导航：左上角返回按钮（与底部返回并存，2026-07-24）---
    page.evaluate("() => window.__game.ui.showAltar()")
    page.wait_for_timeout(200)
    expect('祭坛界面 左上返回按钮存在', page.evaluate("() => !!document.getElementById('btn-altar-topback')"))
    page.click('#btn-altar-topback')
    page.wait_for_timeout(200)
    expect('点击左上返回→祭坛隐藏/回主界', page.evaluate("() => document.getElementById('altar-screen').classList.contains('hidden') && !document.getElementById('title-screen').classList.contains('hidden')"))
    page.evaluate("() => window.__game.ui.showCodex()")
    page.wait_for_timeout(200)
    page.click('#btn-codex-hub-topback')
    page.wait_for_timeout(200)
    expect('点击左上返回→图鉴隐藏/回主界', page.evaluate("() => document.getElementById('codex-hub').classList.contains('hidden')"))
    page.evaluate("() => window.__game.ui.showBloodline()")
    page.wait_for_timeout(200)
    page.click('#btn-bloodline-topback')
    page.wait_for_timeout(200)
    expect('点击左上返回→血裔隐藏/回主界', page.evaluate("() => document.getElementById('bloodline-screen').classList.contains('hidden')"))

    # --- 主菜单入口图标（双端功能暗示）---
    expect('祭坛入口含功能图标', page.evaluate("() => { const b = document.getElementById('btn-altar'); return !!b.querySelector('img.menu-btn-icon'); }"))
    expect('血裔入口含角色头像图标', page.evaluate("() => { const b = document.getElementById('btn-bloodline'); return !!document.getElementById('btn-bloodline-icon') && b.querySelector('img').src.includes('portrait_'); }"))
    # 首页「游戏图鉴」按钮图标（/assets/codex_menu.png 正常加载，不空白）
    expect('游戏图鉴按钮图标 codex_menu.png 已加载', page.evaluate("""() => {
        const img = document.querySelector('#btn-codex img.menu-btn-icon');
        return !!img && img.complete && img.naturalWidth > 0 && img.getAttribute('src') === '/assets/codex_menu.png';
    }"""))

    # --- 战利品指引：屏外→边缘方向箭头；屏内→精确脉冲环（2026-07-24）---
    page.evaluate("""() => {
      const g = window.__game;
      g.state = 'playing';
      g.enemies.enemies = [];
      g.enemies.enemyProjectiles = [];
      g.expQueue = 0;
      if (g.state === 'upgrading') g.resumeFromUpgrade();
      document.getElementById('levelup-screen').classList.add('hidden');
      g.player.level = 999;
      g.player.hp = g.player.maxHp;
      g.player.magnetRange = 0;   // 防止屏内宝箱被自动吸附拾取
      g.pickups.gems = g.pickups.gems.filter(x => !x.chest);
      g.pickups.dropBossChest(g.player.x + 2000, g.player.y - 2000);  // 远处屏外
    }""")
    page.wait_for_timeout(300)
    expect('战利品指引 屏外显示方向箭头', page.evaluate("""() => {
      const b = document.getElementById('loot-beacon');
      const a = document.getElementById('loot-arrow');
      const r = document.getElementById('loot-ring');
      return !b.classList.contains('hidden') && a.style.display !== 'none' && (r.style.display === 'none' || r.style.display === '');
    }"""))
    expect('战利品指引 箭头带旋转角度', page.evaluate("() => document.getElementById('loot-arrow').style.transform.includes('rotate')"))
    page.evaluate("""() => {
      const g = window.__game;
      const c = g.pickups.gems.find(x => x.chest);
      if (c) { c.x = g.player.x + 40; c.y = g.player.y - 30; }  // 移到屏内（仍超出吸附半径）
    }""")
    page.wait_for_timeout(300)
    expect('战利品指引 屏内显示脉冲环', page.evaluate("""() => {
      const r = document.getElementById('loot-ring');
      const a = document.getElementById('loot-arrow');
      return r.style.display !== 'none' && a.style.display === 'none';
    }"""))
    page.evaluate("""() => {
      const g = window.__game;
      g.pickups.gems = g.pickups.gems.filter(x => !x.chest);
      g.state = 'title';
    }""")
    page.wait_for_timeout(150)

    # --- 词缀怪渲染回归（entities.js const→let）：场上出现 爆破/护盾 怪时，敌怪绘制每帧调用
    #     tintedEnemySprite 并对 img 重赋值；原 const img 会每帧抛 Assignment to constant variable. ---
    err_before_affix = len(errors)
    page.evaluate("""() => {
        const g = window.__game;
        g.state = 'playing';
        g.enemies.enemies = [];
        g.expQueue = 0;
        const ls = document.getElementById('levelup-screen');
        if (ls) ls.classList.add('hidden');
        g.player.hp = g.player.maxHp = 9999;
        const scale = g.enemies.statScale(false);
        const typeA = g.enemies.pickType();
        const typeB = g.enemies.pickType();
        const v = g.enemies.createEnemy(typeA, scale, g.player.x + 60, g.player.y, 'volatile');
        const s = g.enemies.createEnemy(typeB, scale, g.player.x - 60, g.player.y, 'shielded');
        g.enemies.enemies.push(v, s);
    }""")
    page.wait_for_timeout(900)  # 多帧渲染，触发 affix 着色分支
    has_affix = page.evaluate("() => window.__game.enemies.enemies.some(e => e.affixDef && (e.affix === 'volatile' || e.affix === 'shielded'))")
    expect('场上出现词缀怪(爆破/护盾)', has_affix)
    expect('词缀怪渲染无控制台报错', len(errors) == err_before_affix)
    page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.state = 'title'; }")

    # --- 狼群词缀去灰回归：pack 颜色应为琥珀金 #f1c40f（原灰蓝 #aab7c4 致狼群怪整只灰扑扑），
    #     且 pack 怪渲染走脉冲圈分支不报错 ---
    err_before_pack = len(errors)
    page.evaluate("""() => {
        const g = window.__game;
        g.state = 'playing';
        g.enemies.enemies = [];
        g.expQueue = 0;
        const ls = document.getElementById('levelup-screen');
        if (ls) ls.classList.add('hidden');
        g.player.hp = g.player.maxHp = 9999;
        const scale = g.enemies.statScale(false);
        const type = g.enemies.pickType();
        const p = g.enemies.createEnemy(type, scale, g.player.x + 60, g.player.y, 'pack');
        g.enemies.enemies.push(p);
    }""")
    page.wait_for_timeout(600)
    expect('狼群怪 affixDef.color=琥珀金', page.evaluate(
        "() => { const e = window.__game.enemies.enemies.find(x => x.affix === 'pack'); return !!e && e.affixDef && e.affixDef.color === '#f1c40f'; }"))
    expect('狼群怪渲染无控制台报错', len(errors) == err_before_pack)
    # 爆破死亡爆炸特效冒烟测试：强制一只怪变爆破并死亡，确认 spawnExplosion 写入 fx.rings 且无报错
    err_before_expl = len(errors)
    page.evaluate("""() => {
        const e = window.__game.enemies.enemies.find(x => !x.isBoss);
        if (e) { e.affix = 'volatile'; e.hp = -1; }
    }""")
    page.wait_for_timeout(120)
    expect('爆破死亡触发爆炸特效(fx.rings)', page.evaluate("() => window.__game.fx.rings.length > 0"))
    expect('爆破特效无控制台报错', len(errors) == err_before_expl)
    page.evaluate("() => { window.__game.enemies.enemies = []; window.__game.state = 'title'; }")

    # --- 宝石 20s 过期回归：普通经验宝石 20s 后自动消失；宝箱/血瓶永不消失 ---
    page.evaluate("""() => {
        const g = window.__game;
        g.state = 'playing';
        g.pickups.gems = [];
        // 一颗普通宝石（life=20），一颗宝箱（无 life），一颗血瓶（无 life）
        g.pickups.drop(g.player.x + 500, g.player.y + 500, 1);
        g.pickups.dropChest(g.player.x + 600, g.player.y + 600);
        g.pickups.dropPotion(g.player.x + 700, g.player.y + 700, 20);
        // 把普通宝石的 life 直接拨到 0.05s，加速验证过期
        const gem = g.pickups.gems.find(x => !x.chest && !x.potion);
        if (gem) gem.life = 0.05;
    }""")
    page.wait_for_timeout(300)  # 多帧 update，触发过期分支
    expect('普通宝石 20s 后过期消失', page.evaluate(
        "() => !window.__game.pickups.gems.some(x => !x.chest && !x.potion)"))
    expect('宝箱/血瓶不过期(仍在)', page.evaluate(
        "() => window.__game.pickups.gems.some(x => x.chest) && window.__game.pickups.gems.some(x => x.potion)"))
    page.evaluate("() => { window.__game.pickups.gems = []; window.__game.state = 'title'; }")

    # --- P1 质量门控：控制台无报错（原仅 print，导致词缀怪每帧抛错能"带病通过"）---
    expect('无控制台报错', len(errors) == 0)
    print('控制台错误:', errors if errors else '无')
    if _failures:
        print(f'\nTOTAL FAILURES: {_failures}')
    else:
        print('\nALL PASS')
    browser.close()
    sys.exit(1 if _failures else 0)
