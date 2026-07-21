from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173/?debug'

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
    page.wait_for_timeout(500)

    # 等待 60 秒看自然死亡（加强密度后应该能死）
    dead = False
    for i in range(75):
        page.wait_for_timeout(1000)
        go_visible = page.evaluate("() => !document.getElementById('gameover-screen').classList.contains('hidden')")
        if go_visible:
            dead = True
            print(f'自然死亡于第 {i+1} 秒')
            break
        # 每 15 秒打印一次存活状态
        if (i + 1) % 15 == 0:
            st = page.evaluate("() => ({hp: window.__game.player.hp, t: Math.floor(window.__game.time), enemies: window.__game.enemies.enemies.length})")
            print(f'第{i+1}秒: 时间={st["t"]}s HP={st["hp"]:.0f} 敌人数={st["enemies"]}')

    if not dead:
        print('75秒内未自然死亡，调试钩子直接扣血验证结算流程')
        page.evaluate("() => { window.__game.player.hp = 1; }")
        for _ in range(15):
            page.wait_for_timeout(500)
            go_visible = page.evaluate("() => !document.getElementById('gameover-screen').classList.contains('hidden')")
            if go_visible:
                dead = True
                break

    print('死亡结算触发:', dead)
    page.screenshot(path='/tmp/ns_gameover.png')
    stats = page.evaluate("""() => [...document.querySelectorAll('.stat-line')].map(el => el.textContent)""")
    print('结算数据:', stats)

    # 重开
    page.click('#btn-retry')
    page.wait_for_timeout(800)
    hud_visible = page.evaluate("() => !document.getElementById('hud').classList.contains('hidden')")
    print('重开后 HUD 恢复:', hud_visible)
    st = page.evaluate("() => ({hp: window.__game.player.hp, t: Math.floor(window.__game.time), lv: window.__game.player.level})")
    print('重开后状态:', st)

    # 返回主界面，验证最高纪录持久化
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    best = page.evaluate("() => document.getElementById('best-record').textContent")
    print('主界面最高纪录:', best)
    page.screenshot(path='/tmp/ns_title2.png')

    print('控制台错误:', errors if errors else '无')
    browser.close()
