from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173/?debug'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    page.click('#btn-start')
    page.wait_for_timeout(500)

    # 直接注入神器 devour（模拟已进化），再压血贴脸
    page.evaluate("""() => {
      const g = window.__game;
      g.weapons.addArtifact('devour');
      g.player.hp = 0.5; g.player.iframes = 0;
    }""")
    for i in range(8):
        st = page.evaluate("""() => {
          const g = window.__game;
          return {
            state: g.state, hp: +g.player.hp.toFixed(1),
            enemies: g.enemies.enemies.length,
            e0: g.enemies.enemies[0] ? {hp:+g.enemies.enemies[0].hp.toFixed(1), d:+Math.hypot(g.enemies.enemies[0].x-g.player.x, g.enemies.enemies[0].y-g.player.y).toFixed(1)} : null,
          };
        }""")
        print(f'{i*0.6:.1f}s', st)
        if st['state'] == 'gameover':
            print('已死亡')
            break
        # 持续把最近怪贴脸
        page.evaluate("""() => {
          const g = window.__game;
          const e = g.enemies.enemies[0];
          if (e) { e.x = g.player.x; e.y = g.player.y; e.hitCooldown = 0; }
          g.player.iframes = 0;
        }""")
        page.wait_for_timeout(600)
    browser.close()
