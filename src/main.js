import { Game } from './game.js';
import { DIFFICULTIES } from './data.js';
import { MobileControls } from './mobile-controls.js';

const game = new Game();
game.init();

// 触屏设备检测：激活手机端控件
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouchDevice) {
  const mobileControls = new MobileControls(game);
  mobileControls.enable();
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
