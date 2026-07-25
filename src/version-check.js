// 运行时版本自检：boot 阶段非阻断发起，比对「当前运行构建号」与「线上最新构建号」。
// 不一致则派发 'version-mismatch' 事件并填充 window.__versionInfo，由 UI 横幅提示刷新。
// 设计红线：离线 / 404(dev 无 version.json) / JSON 异常 全部静默跳过，绝不影响游戏启动；
// 绝不读写 localStorage（刷新只 location.reload，不触及存档）。
const CURRENT = __BUILD_ID__;
// 暴露给内联脚本/调试对齐契约（与 assets.js/ui.js 同源写法）
window.__BUILD_ID__ = CURRENT;

export function initVersionCheck() {
  // 注册横幅显隐 + 按钮事件（一次性，先于异步 fetch 完成）
  setupPrompt();
  // 非阻断发起比对（fire-and-forget，不阻塞 game.init）
  runVersionCheck().catch(() => {
    /* 双保险：内部已吞掉所有异常，这里不应触发 */
  });
  // 周期复检：长开页面的玩家在后台发版后也能被提示（每 90s）。
  // 90s 足够稀疏，不会给 version.json 带来可感知压力；X5 无视 no-store，
  // 故每次都用带戳 URL 做缓存击穿（见 fetchVersionUrl）。
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      runVersionCheck().catch(() => {});
    }, 90000);
  }
}

// 微信 X5 内核无视 Cache-Control: no-store，按其「按完整 URL 命中」的应用级缓存回旧文件，
// 导致 fetch('/version.json') 拿到与旧 HTML 同源的陈旧版本 → 自检失效。
// 加时间戳 query 做缓存击穿：每次 URL 唯一 → 必走网络 → 拿到最新 version.json。
function fetchVersionUrl() {
  return '/version.json?t=' + Date.now();
}

function runVersionCheck() {
  return fetch(fetchVersionUrl(), { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) return; // 404(dev) / 5xx → 静默跳过，不弹横幅
      return res.json().then((latest) => {
        const hasUpdate = !!latest.buildId && latest.buildId !== CURRENT;
        window.__versionInfo = {
          buildId: latest.buildId ?? null,
          commit: latest.commit ?? null,
          builtAt: latest.builtAt ?? null,
          hasUpdate,
        };
        if (hasUpdate) {
          document.dispatchEvent(
            new CustomEvent('version-mismatch', {
              detail: { current: CURRENT, latest: latest.buildId, builtAt: latest.builtAt ?? null },
            }),
          );
        }
      });
    })
    .catch(() => {
      // offline / 网络失败 / JSON 解析失败：静默降级，绝不影响游戏启动
      window.__versionInfo = { buildId: null, commit: null, builtAt: null, hasUpdate: false };
    });
}

function setupPrompt() {
  const prompt = document.getElementById('update-prompt');
  if (!prompt) return;

  // 不一致事件 → 显隐横幅（命中 sessionStorage「稍后」则本次不弹）
  document.addEventListener('version-mismatch', (e) => {
    const { current, latest } = e.detail;
    // sessionStorage 记忆：已对 latest 版本点过「稍后」→ 本次会话不再弹
    try {
      if (sessionStorage.getItem('ns_update_dismiss') === latest) return;
    } catch (_) {
      /* sessionStorage 不可用则照常弹 */
    }
    // 记录 latest，供「稍后」按钮写入记忆（针对该版本）
    prompt.dataset.latest = latest;
    // 可选副信息：当前 vX → 最新 vY
    const meta = prompt.querySelector('.up-meta');
    if (meta) {
      meta.textContent = `当前 v${current} → 最新 v${latest}`;
      meta.hidden = false;
    }
    prompt.hidden = false;
    // 键盘可达：焦点移到主按钮「立即刷新」
    const reloadBtn = prompt.querySelector('[data-action="reload"]');
    if (reloadBtn) reloadBtn.focus();
  });

  // 按钮事件（事件委托）
  prompt.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'later') {
      // 写 sessionStorage 记忆（针对该 latest 版本），隐藏横幅
      const latest = prompt.dataset.latest || (window.__versionInfo && window.__versionInfo.buildId) || '';
      try {
        sessionStorage.setItem('ns_update_dismiss', latest);
      } catch (_) {
        /* 忽略：记忆失败仅导致下次仍可能弹 */
      }
      prompt.hidden = true;
    } else if (action === 'reload') {
      location.reload(true);
    }
  });
}
