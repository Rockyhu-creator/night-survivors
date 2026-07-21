import { Game } from './game.js';

const game = new Game();
game.init();

document.getElementById('btn-start').addEventListener('click', () => game.startRun());
document.getElementById('btn-retry').addEventListener('click', () => game.startRun());
document.getElementById('btn-home').addEventListener('click', () => game.showTitle());

game.showTitle();
