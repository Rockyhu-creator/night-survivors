from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173/?debug'

def expect(name, cond):
    print(('PASS' if cond else 'FAIL'), name)
    return cond

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 1. 基础流程：开始 → 移动 → 升级三选一
    page.click('#btn-start')
    page.wait_for_timeout(400)
    upgraded = False
    moves = ['KeyW', 'KeyD', 'KeyS', 'KeyA']
    for i in range(40):
        page.keyboard.down(moves[i % 4])
        page.wait_for_timeout(600)
        page.keyboard.up(moves[i % 4])
        lv = page.evaluate("() => !document.getElementById('levelup-screen').classList.contains('hidden')")
        if lv:
            upgraded = True
            page.screenshot(path='/tmp/e2e_levelup.png')
            page.click('.upgrade-card')
            page.wait_for_timeout(400)
            break
    expect('升级三选一流程', upgraded)

    # 2. 神器进化：注入满级圣水+引力宝珠 → 宝箱 → 圣洁吞噬
    page.evaluate("""() => {
      const g = window.__game;
      g.weapons.addWeapon('holywater');
      for (let i = 0; i < 4; i++) g.weapons.upgradeWeapon('holywater');
      g.player.passives.set('magnet', 1);
      g.pickups.dropChest(g.player.x, g.player.y);
    }""")
    page.wait_for_timeout(900)
    banner = page.evaluate("() => !document.getElementById('evolution-banner').classList.contains('hidden')")
    got_devour = page.evaluate("() => window.__game.weapons.hasArtifact('devour')")
    lost_hw = page.evaluate("() => !window.__game.weapons.hasWeapon('holywater')")
    expect('进化横幅出现', banner)
    expect('获得神器 圣洁吞噬', got_devour)
    expect('原武器 圣水洗礼 被替换', lost_hw)
    page.screenshot(path='/tmp/e2e_evolution.png')

    # 3. 神器运行无报错（devour 跟随领域持续灼烧）
    page.wait_for_timeout(2000)
    devour_pool = page.evaluate("() => Boolean(window.__game.weapons.devourPool)")
    expect('圣洁吞噬领域激活', devour_pool)

    # 4. 死亡结算 + 重开（压低血量,循环把最近怪贴脸直至受击死亡;有 devour 领域时怪可能先被烧死,故循环补贴）
    page.evaluate("() => { window.__game.player.hp = 0.5; window.__game.player.iframes = 0; }")
    dead = False
    for _ in range(30):
        go = page.evaluate("""() => {
          const g = window.__game;
          if (g.state === 'gameover') return true;
          const e = g.enemies.enemies[0];
          if (e) { e.x = g.player.x; e.y = g.player.y; e.hitCooldown = 0; }
          g.player.iframes = 0;
          return false;
        }""")
        if go:
            dead = True
            break
        page.wait_for_timeout(400)
    expect('死亡结算界面', dead)
    page.click('#btn-retry')
    page.wait_for_timeout(600)
    restarted = page.evaluate("() => window.__game.player.hp === 100 && Math.floor(window.__game.time) === 0")
    expect('重开状态重置', restarted)

    # 5. 图鉴：解锁与隐藏配方
    page.evaluate("() => window.__game.ui.showTitle()")
    page.wait_for_timeout(300)
    page.click('#btn-codex')
    page.wait_for_timeout(500)
    total = page.evaluate("() => document.querySelectorAll('.codex-card').length")
    devour_unlocked = page.evaluate("""() => {
      const cards = [...document.querySelectorAll('.codex-card')];
      return cards.some(c => !c.classList.contains('locked') && c.textContent.includes('圣洁吞噬'));
    }""")
    hidden_masked = page.evaluate("""() => {
      const cards = [...document.querySelectorAll('.codex-card.locked')];
      return cards.some(c => c.textContent.includes('???'));
    }""")
    expect('图鉴卡片总数 14 (4武器+4被动+6神器)', total == 14)
    expect('图鉴中 圣洁吞噬 已解锁', devour_unlocked)
    expect('隐藏神器未解锁显示 ???', hidden_masked)
    page.screenshot(path='/tmp/e2e_codex.png')

    print('控制台错误:', errors if errors else '无')
    browser.close()
