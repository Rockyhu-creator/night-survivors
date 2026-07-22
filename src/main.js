import { Game } from './game.js';
import { DIFFICULTIES } from './data.js';
import { MobileControls } from './mobile-controls.js';

const game = new Game();
game.init();

// 触屏设备检测：激活手机端控件
// 多重检测，任一命中即认为触屏设备（兼容微信 WebView 等特殊环境）
// - ontouchstart：最基础 API，兼容性好
// - maxTouchPoints：标准 API，能区分触屏/非触屏设备
// - pointer: coarse：CSS 媒体查询，部分 WebView 不支持
const isTouchDevice =
  'ontouchstart' in window ||
  (navigator.maxTouchPoints || 0) > 0 ||
  (navigator.msMaxTouchPoints || 0) > 0 ||
  window.matchMedia('(pointer: coarse)').matches;
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
// 暂停界面的"继续"按钮（桌面/移动端通用，移动端主要恢复路径）
document.getElementById('btn-resume').addEventListener('click', () => {
  if (game.state === 'paused') game.togglePause();
});

game.showTitle();

// 自动化测试调试钩子
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__game = game;
}
