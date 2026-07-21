import { Game } from './game.js';

const game = new Game();
game.init();

document.getElementById('btn-start').addEventListener('click', () => game.startRun());
document.getElementById('btn-retry').addEventListener('click', () => game.startRun());
document.getElementById('btn-home').addEventListener('click', () => game.showTitle());

game.showTitle();

// 自动化测试调试钩子
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__game = game;
}
