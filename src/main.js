import { Game } from './game.js';
import { DIFFICULTIES } from './data.js';
import { MobileControls } from './mobile-controls.js';

// 触屏设备检测：必须在 game.init() 之前完成，
// 因为 game.init() 内部会调用 resize()，resize() 依赖 .touch-device class 判断是否走竖屏动态分辨率
// 多重检测，任一命中即认为触屏设备（兼容微信 WebView 等特殊环境）
const isTouchDevice =
  'ontouchstart' in window ||
  (navigator.maxTouchPoints || 0) > 0 ||
  (navigator.msMaxTouchPoints || 0) > 0 ||
  window.matchMedia('(pointer: coarse)').matches;
if (isTouchDevice) {
  document.documentElement.classList.add('touch-device');
}

const game = new Game();
game.init();

if (isTouchDevice) {
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

// 声音开关：默认静音，点击切换（M 键同效，见 game.onKey）
const muteBtn = document.getElementById('btn-mute');
muteBtn.textContent = game.audio.enabled ? '🔊' : '🔇';
muteBtn.addEventListener('click', () => game.toggleMute());

// 浏览器自动播放策略：首次用户手势时解锁 AudioContext
// （AudioManager 内部已按 enabled 判断，未开启声音则不会真正创建上下文）
const unlockAudio = () => { game.audio.ensureCtx(); };
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// 自动化测试调试钩子
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__game = game;
}
