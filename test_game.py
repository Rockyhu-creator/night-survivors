from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1200)
    page.click('#btn-start')

    # 持续游走，让经验积累到升级
    moves = ['KeyW', 'KeyD', 'KeyS', 'KeyA']
    upgraded = False
    for round_i in range(30):
        key = moves[round_i % 4]
        page.keyboard.down(key)
        page.wait_for_timeout(700)
        page.keyboard.up(key)
        lv_visible = page.evaluate("() => !document.getElementById('levelup-screen').classList.contains('hidden')")
        if lv_visible and not upgraded:
            upgraded = True
            page.screenshot(path='/tmp/ns_levelup.png')
            cards = page.locator('.upgrade-card').count()
            print(f'升级弹窗出现，卡牌数: {cards}')
            page.click('.upgrade-card')
            page.wait_for_timeout(400)
        # 游戏是否死亡
        go_visible = page.evaluate("() => !document.getElementById('gameover-screen').classList.contains('hidden')")
        if go_visible:
            print('游戏结束界面出现')
            page.screenshot(path='/tmp/ns_gameover.png')
            break

    state = page.evaluate("""() => ({
      t: document.getElementById('timer').textContent,
      hp: document.getElementById('hp-text').textContent,
      lv: document.getElementById('level-text').textContent,
      kills: document.getElementById('kill-count').textContent,
      loadout: document.getElementById('loadout').children.length,
    })""")
    print('最终 HUD:', state)
    print('升级流程触发:', upgraded)
    page.screenshot(path='/tmp/ns_late.png')
    print('控制台错误:', errors if errors else '无')
    browser.close()
