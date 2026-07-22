import { Game } from './game.js';
import { DIFFICULTIES } from './data.js';
import { MobileControls } from './mobile-controls.js';

const game = new Game();
game.init();

// 触屏设备检测：激活手机端控件
// 不依赖 CSS 的 pointer: coarse 媒体查询（微信内置浏览器等可能不支持），
// 改为 JS 检测后给 <html> 加 .touch-device class，CSS 基于此 class 控制显隐
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouchDevice) {
  document.documentElement.classList.add('touch-device');
  const mobileControls = new MobileControls(game);
  mobileControls.enable();

  // 方向变化时重新计算分辨率（game.resize() 已监听 window 'resize'，
  // 但 orientationchange 在某些移动浏览器需要单独监听 + 延迟读取尺寸）
  window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 100));
  // 微信 WebView 可能不触发 orientationchange，加 200ms 轮询兜底
  let lastPortrait = window.innerHeight > window.innerWidth;
  setInterval(() => {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait !== lastPortrait) {
      lastPortrait = isPortrait;
      game.resize();
    }
  }, 200);
}

// 难度选择
const diffDesc = document.getElementById('diff-desc');
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.diff;
    game.setDifficulty(id);
    diffDesc.textContent = DIFFICULTIES[id].desc;
  });
});

document.getElementById('btn-start').addEventListener('click', () => game.startRun());
document.getElementById('btn-retry').addEventListener('click', () => game.startRun());
document.getElementById('btn-home').addEventListener('click', () => game.showTitle());
document.getElementById('btn-codex').addEventListener('click', () => game.ui.showCodex());
document.getElementById('btn-codex-back').addEventListener('click', () => game.ui.hideCodex());

game.showTitle();

// 自动化测试调试钩子
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__game = game;
}
