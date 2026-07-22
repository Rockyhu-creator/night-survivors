import { CONFIG, DIFFICULTIES, expForLevel, unlockInCollection } from './data.js';
import { loadAssets, sprite } from './assets.js';
import { Input, Camera } from './engine.js';
import { Player, EnemyManager } from './entities.js';
import { WeaponSystem } from './weapons.js';
import { PickupSystem, FXSystem } from './systems.js';
import { UpgradeSystem } from './upgrade.js';
import { UIManager } from './ui.js';
import { findEvolvableRecipe, performEvolution } from './evolution.js';

const STEP = 1 / 60;

export class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = 'loading';
    this.time = 0;
    this.kills = 0;
    this.expQueue = 0;
    this.accumulator = 0;
    this.lastTs = 0;
    this.rerollsLeft = 3;
    this.banishesLeft = 3;
    this.difficulty = DIFFICULTIES.normal;
    this.groundPattern = null;
    this.decals = [];
    this.generateDecals();
  }

  generateDecals() {
    // 预生成一片 3000x3000 区域内的环境装饰（墓碑/枯木/碎石），相机移动时只画视野内的
    this.decals.length = 0;
    let seed = 12345;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 260; i += 1) {
      this.decals.push({
        x: (rand() - 0.5) * 3000,
        y: (rand() - 0.5) * 3000,
        kind: Math.floor(rand() * 3),
        s: 0.7 + rand() * 0.7,
        flip: rand() > 0.5,
      });
    }
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = CONFIG.LOGICAL_WIDTH;
    this.canvas.height = CONFIG.LOGICAL_HEIGHT;
    this.ctx.imageSmoothingEnabled = false;

    this.input = new Input();
    this.camera = new Camera();
    this.player = new Player();
    this.enemies = new EnemyManager(this);
    this.weapons = new WeaponSystem(this);
    this.pickups = new PickupSystem(this);
    this.fx = new FXSystem();
    this.upgrade = new UpgradeSystem(this);
    this.ui = new UIManager(this);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.resize();

    loadAssets().then(() => {
      const ground = sprite('ground');
      if (ground) {
        // 地面纹理放大到 128 平铺并整体压暗提亮层次
        const tile = document.createElement('canvas');
        tile.width = 128;
        tile.height = 128;
        const tctx = tile.getContext('2d');
        tctx.drawImage(ground, 0, 0, 128, 128);
        tctx.fillStyle = 'rgba(46, 36, 72, 0.45)';
        tctx.fillRect(0, 0, 128, 128);
        this.groundPattern = this.ctx.createPattern(tile, 'repeat');
      }
      if (this.state === 'loading') this.state = 'title';
    });

    requestAnimationFrame((ts) => this.frame(ts));
  }

  resize() {
    const scale = Math.min(
      window.innerWidth / CONFIG.LOGICAL_WIDTH,
      window.innerHeight / CONFIG.LOGICAL_HEIGHT,
    );
    const w = Math.floor(CONFIG.LOGICAL_WIDTH * scale);
    const h = Math.floor(CONFIG.LOGICAL_HEIGHT * scale);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.style.left = `${Math.floor((window.innerWidth - w) / 2)}px`;
    this.canvas.style.top = `${Math.floor((window.innerHeight - h) / 2)}px`;
  }

  showTitle() {
    this.state = 'title';
    this.ui.showTitle();
  }

  setDifficulty(id) {
    this.difficulty = DIFFICULTIES[id] || DIFFICULTIES.normal;
  }

  startRun() {
    this.time = 0;
    this.kills = 0;
    this.expQueue = 0;
    this.accumulator = 0;
    this.rerollsLeft = 3;
    this.banishesLeft = 3;
    this.player.reset();
    this.enemies.reset();
    this.weapons.reset();
    this.pickups.reset();
    this.fx.reset();
    this.upgrade.reset();
    this.camera.x = -CONFIG.LOGICAL_WIDTH / 2;
    this.camera.y = -CONFIG.LOGICAL_HEIGHT / 2;
    this.camera.trauma = 0;
    this.weapons.addWeapon('blade');
    unlockInCollection('blade');
    this.ui.startGame();
    this.state = 'playing';
  }

  frame(ts) {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.lastTs) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.25) dt = 0.25;

    if (this.state === 'playing') {
      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.accumulator -= STEP;
        this.step(STEP);
      }
      this.render();
      this.ui.update(dt);
    } else if (this.state === 'title' || this.state === 'gameover') {
      this.renderBackdropOnly(dt);
    } else if (this.state === 'upgrading' || this.state === 'paused') {
      this.render();
    }
  }

  onKey(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.togglePause();
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause-overlay').classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.lastTs = 0;
      document.getElementById('pause-overlay').classList.add('hidden');
    }
  }

  step(dt) {
    this.time += dt;
    this.player.update(dt, this.input);
    this.camera.follow(this.player, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT, dt);
    this.enemies.update(dt);
    this.weapons.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    this.processLevelUps();
    if (this.player.hp <= 0) this.gameOver();
  }

  processLevelUps() {
    const player = this.player;
    let needed = expForLevel(player.level);
    let leveled = false;
    while (player.exp >= needed) {
      player.exp -= needed;
      player.level += 1;
      this.expQueue += 1;
      leveled = true;
      needed = expForLevel(player.level);
    }
    // 升级回满血（对齐官方吸血鬼幸存者机制）
    if (leveled) player.hp = player.maxHp;
    if (this.expQueue > 0) {
      const options = this.upgrade.rollOptions();
      if (options.length > 0) {
        this.expQueue -= 1;
        this.state = 'upgrading';
        this.upgrade.open(options);
      } else {
        this.expQueue = 0;
      }
    }
  }

  resumeFromUpgrade() {
    this.state = 'playing';
    this.lastTs = 0;
  }

  gainExp(amount) {
    this.player.exp += amount * (this.player.expMul || 1);
  }

  onEnemyKilled(enemy) {
    this.kills += 1;
    this.pickups.drop(enemy.x, enemy.y, enemy.expValue);
    this.fx.spawnSparks(enemy.x, enemy.y, '#e74c3c', 6);
  }

  onBossSpawn(def) {
    this.ui.showBossWarning(def.name);
    this.camera.addShake(0.8);
  }

  onBossKilled(e) {
    this.ui.hideBossBar();
    this.pickups.dropBossChest(e.x, e.y);
    this.fx.spawnSparks(e.x, e.y, '#d4af37', 40);
    this.camera.addShake(1);
  }

  onChestOpened(chest = {}) {
    const recipe = findEvolvableRecipe(this.player, this.weapons);
    if (recipe) {
      const artifact = performEvolution(this.player, this.weapons, recipe);
      this.ui.showEvolutionBanner(artifact);
      this.ui.refreshLoadout();
      this.fx.spawnSparks(this.player.x, this.player.y, '#d4af37', 30);
    } else if (chest.boss) {
      this.gainExp(40);
      this.player.hp = this.player.maxHp;
      this.ui.showToast('Boss 宝箱: +40 经验,生命回满');
    } else {
      this.gainExp(25);
      this.ui.showToast('宝箱: +25 经验');
    }
  }

  onPlayerHit() {
    this.camera.addShake(0.55);
    this.ui.flashVignette();
  }

  gameOver() {
    this.state = 'gameover';
    this.ui.showGameOver();
  }

  renderBackdropOnly() {
    this.ctx.fillStyle = '#0d0a1a';
    this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
  }

  renderDecals(ctx, cam) {
    const w = CONFIG.LOGICAL_WIDTH;
    const h = CONFIG.LOGICAL_HEIGHT;
    ctx.save();
    for (const d of this.decals) {
      const sx = d.x - cam.ox;
      const sy = d.y - cam.oy;
      if (sx < -60 || sy < -60 || sx > w + 60 || sy > h + 60) continue;
      const s = d.s;
      ctx.save();
      ctx.translate(sx, sy);
      if (d.flip) ctx.scale(-1, 1);
      ctx.scale(s, s);
      ctx.fillStyle = 'rgba(16, 11, 28, 0.9)';
      if (d.kind === 0) {
        // 墓碑
        ctx.fillRect(-7, -16, 14, 18);
        ctx.beginPath();
        ctx.arc(0, -16, 7, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-2, -22, 4, 6);
      } else if (d.kind === 1) {
        // 枯木
        ctx.fillRect(-2, -22, 4, 24);
        ctx.fillRect(-9, -18, 8, 3);
        ctx.fillRect(1, -26, 9, 3);
      } else {
        // 碎石堆
        ctx.beginPath();
        ctx.arc(-5, 0, 4, 0, Math.PI * 2);
        ctx.arc(3, -2, 5, 0, Math.PI * 2);
        ctx.arc(8, 1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  render() {
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.fillStyle = '#0d0a1a';
    ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

    // 地面
    if (this.groundPattern) {
      ctx.save();
      ctx.translate(-cam.ox % CONFIG.TILE, -cam.oy % CONFIG.TILE);
      ctx.fillStyle = this.groundPattern;
      ctx.fillRect(-CONFIG.TILE, -CONFIG.TILE,
        CONFIG.LOGICAL_WIDTH + CONFIG.TILE * 2, CONFIG.LOGICAL_HEIGHT + CONFIG.TILE * 2);
      ctx.restore();
    }

    this.renderDecals(ctx, cam);
    this.pickups.render(ctx, cam);
    this.weapons.render(ctx, cam);
    this.enemies.render(ctx, cam);
    this.player.render(ctx, cam);
    this.fx.render(ctx, cam);

    // 暗夜氛围边缘暗角
    const grad = ctx.createRadialGradient(
      CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2, CONFIG.LOGICAL_HEIGHT * 0.42,
      CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2, CONFIG.LOGICAL_HEIGHT * 0.95,
    );
    grad.addColorStop(0, 'rgba(6,4,16,0)');
    grad.addColorStop(1, 'rgba(6,4,16,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
  }
}
