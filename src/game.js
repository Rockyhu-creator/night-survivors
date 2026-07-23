import { CONFIG, DIFFICULTIES, expForLevel, unlockInCollection, SOUL_REWARDS, ALTAR, BLOODLINES, loadSouls, saveSouls, addSouls, isUnlocked, getSelectedBloodline, setSelectedBloodline, isBloodlineUnlocked } from './data.js';
import { loadAssets, sprite } from './assets.js';
import { Input, Camera } from './engine.js';
import { Player, EnemyManager } from './entities.js';
import { WeaponSystem } from './weapons.js';
import { PickupSystem, FXSystem } from './systems.js';
import { UpgradeSystem } from './upgrade.js';
import { UIManager } from './ui.js';
import { findEvolvableRecipe, performEvolution } from './evolution.js';
import { AudioManager } from './audio.js';

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
    this.bossKills = 0;
    this.soulGainMul = 1;
    this.runSouls = 0;
    this.totalSouls = 0;
    this.difficulty = DIFFICULTIES.normal;
    this.bloodline = 'wanderer';
    // 相机纵向锚点：0.5=居中；竖屏下由 resize() 改为 0.42（玩家偏上，避免手指遮挡下方视野）
    this.cameraAnchorY = 0.5;
    this.groundPattern = null;
    this._vignetteCanvas = null; // 暗角离屏缓存：避免每帧 createRadialGradient
    this.decals = [];
    this.generateDecals();
  }

  generateDecals() {
    // 预生成一片 3000x3000 区域内的环境装饰（墓碑/枯木/碎石），相机移动时只画视野内的
    this.decals.length = 0;
    let seed = 12345;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    // 装饰密度 [PLACEHOLDER]：260→150 约降 42%，整体更通透；真机可微调 120~180
    const COUNT = 150;
    // 加权随机：大件(墓碑/枯木/碎石)少、小件(枯骨/十字架)多，呈现自然散落墓园
    const weights = [2, 2, 3, 5, 4]; // tomb, wood, rubble, bone, cross
    const wsum = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < COUNT; i += 1) {
      let r = rand() * wsum;
      let kind = 0;
      for (let k = 0; k < weights.length; k += 1) {
        if (r < weights[k]) { kind = k; break; }
        r -= weights[k];
      }
      // 大件缩放偏大、小件(枯骨/十字架)偏小，强化“散落点缀”观感
      let sBase, sVar;
      if (kind === 3) { sBase = 0.5; sVar = 0.45; }       // 枯骨：小
      else if (kind === 4) { sBase = 0.6; sVar = 0.4; }   // 十字架：中小
      else { sBase = 0.8; sVar = 0.5; }                   // 墓碑/枯木/碎石
      this.decals.push({
        x: (rand() - 0.5) * 3000,
        y: (rand() - 0.5) * 3000,
        kind,
        s: sBase + rand() * sVar,
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
    this.player.game = this;  // 注入 game 引用，供玩家渲染按血裔切换精灵
    this.enemies = new EnemyManager(this);
    this.weapons = new WeaponSystem(this);
    this.pickups = new PickupSystem(this);
    this.fx = new FXSystem();
    this.upgrade = new UpgradeSystem(this);
    this.ui = new UIManager(this);
    this.audio = new AudioManager();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.resize();

    loadAssets().then(() => {
      this.regenerateGroundPattern();
      if (this.state === 'loading') this.state = 'title';
    });

    requestAnimationFrame((ts) => this.frame(ts));
  }

  // 重新生成地面 pattern（canvas 重建后调用）
  regenerateGroundPattern() {
    const ground = sprite('ground');
    if (!ground || !this.ctx) return;
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const tctx = tile.getContext('2d');
    tctx.drawImage(ground, 0, 0, 128, 128);
    tctx.fillStyle = 'rgba(46, 36, 72, 0.45)';
    tctx.fillRect(0, 0, 128, 128);
    this.groundPattern = this.ctx.createPattern(tile, 'repeat');
  }

  resize() {
    // 仅触屏设备启用竖屏模式（桌面端缩窗口不触发）
    const isTouchDevice = document.documentElement.classList.contains('touch-device');
    // 竖屏判定：高明显大于宽（避免边缘 case 误判，如 browser automation 时尺寸为 0）
    const isPortrait = isTouchDevice && window.innerHeight > window.innerWidth * 1.2;
    // 动态逻辑分辨率：竖屏下保持宽 540，高度按屏幕实际比例计算，铺满全屏无黑边
    // 高度范围 [960, 1400]：下限保证至少和原来一样的视野，上限避免极端狭长手机看到过多内容
    if (isPortrait) {
      const ratio = window.innerHeight / window.innerWidth;
      CONFIG.LOGICAL_WIDTH = 540;
      CONFIG.LOGICAL_HEIGHT = Math.max(960, Math.min(1400, Math.round(540 * ratio)));
      document.documentElement.classList.add('portrait');
    } else {
      CONFIG.LOGICAL_WIDTH = 960;
      CONFIG.LOGICAL_HEIGHT = 540;
      document.documentElement.classList.remove('portrait');
    }
    // 竖屏时相机锚点上移：玩家显示在画面 42% 高度处，下方多留视野（手指操作区在下半屏）
    this.cameraAnchorY = isPortrait ? 0.42 : 0.5;
    this.canvas.width = CONFIG.LOGICAL_WIDTH;
    this.canvas.height = CONFIG.LOGICAL_HEIGHT;
    this.ctx.imageSmoothingEnabled = false;
    // 重新生成地面 pattern（canvas 尺寸变化后 pattern 可能失效）
    this.regenerateGroundPattern();
    // 等比缩放居中
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
    // 相机重新跟随玩家（避免方向切换后画面错位）
    if (this.player && this.player.x !== undefined) {
      this.camera.x = this.player.x - CONFIG.LOGICAL_WIDTH / 2;
      this.camera.y = this.player.y - CONFIG.LOGICAL_HEIGHT * this.cameraAnchorY;
    }
  }

  showTitle() {
    this.state = 'title';
    this.ui.showTitle();
  }

  setDifficulty(id) {
    this.difficulty = DIFFICULTIES[id] || DIFFICULTIES.normal;
  }

  // 选择血裔（仅在已解锁时生效）。返回是否成功
  setBloodline(id) {
    if (!isBloodlineUnlocked(id)) return false;
    this.bloodline = id;
    setSelectedBloodline(id);
    return true;
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
    this.camera.y = -CONFIG.LOGICAL_HEIGHT * this.cameraAnchorY;
    this.camera.trauma = 0;
    this.audio.uiClick();
    // 注入选定血裔：起始武器 + 属性偏向（S2 开局差异）
    const bl = BLOODLINES.find((b) => b.id === getSelectedBloodline()) || BLOODLINES[0];
    this.bloodline = bl.id;
    if (bl.weapon) {
      this.weapons.addWeapon(bl.weapon);
      unlockInCollection(bl.weapon);
    }
    bl.apply(this);
    // 注入已解锁的祭坛永久增益（灵魂货币长期循环）
    this.soulGainMul = 1;
    for (const a of ALTAR) {
      if (isUnlocked(a.id)) a.apply(this);
    }
    // 增益可能抬高 maxHp，同步回满血避免开局残血
    this.player.hp = this.player.maxHp;
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
    } else if (e.code === 'KeyM') {
      this.toggleMute();
    }
  }

  // 声音开关（右上角按钮与 M 键共用），同步更新按钮图标
  toggleMute() {
    const on = this.audio.toggle();
    const btn = document.getElementById('btn-mute');
    if (btn) btn.textContent = on ? '🔊' : '🔇';
    if (on) this.audio.uiClick();
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
    this.camera.follow(this.player, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT, dt, this.cameraAnchorY);
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
        this.audio.levelup();
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
    // 血瓶续航掉落 [PLACEHOLDER]：约 7% 概率，解决"掉血不可逆"。Boss 由专属宝箱覆盖，不重复掉
    if (!enemy.isBoss && Math.random() < 0.07) {
      this.pickups.dropPotion(enemy.x, enemy.y, 20);
    }
    this.fx.spawnSparks(enemy.x, enemy.y, '#e74c3c', 6);
    this.audio.kill();
  }

  onBossSpawn(def) {
    this.ui.showBossWarning(def.name);
    this.camera.addShake(0.8);
    this.audio.bossWarning();
  }

  onBossKilled(e) {
    this.bossKills += 1;
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
      this.audio.evolve();
    } else if (chest.boss) {
      this.gainExp(40);
      this.player.hp = this.player.maxHp;
      this.ui.showToast('Boss 宝箱: +40 经验,生命回满');
      this.audio.chest();
    } else {
      this.gainExp(25);
      this.ui.showToast('宝箱: +25 经验');
      this.audio.chest();
    }
  }

  onPlayerHit() {
    this.camera.addShake(0.55);
    this.ui.flashVignette();
    this.audio.hit();
  }

  // 结算灵魂：存活/击杀/等级/Boss + 难度首通（一次性）
  computeSoulReward() {
    const r = SOUL_REWARDS;
    let reward =
      Math.floor(this.time / 30) * r.per30s +
      Math.floor(this.kills / 20) * r.per20Kills +
      this.player.level * r.perLevel +
      this.bossKills * r.perBoss;
    // 难度首通（一次性）：写入 cleared 并持久化，余额不变
    const souls = loadSouls();
    if (!souls.cleared.includes(this.difficulty.id)) {
      souls.cleared.push(this.difficulty.id);
      reward += r.firstClear[this.difficulty.id] || 0;
      saveSouls(souls);
    }
    return Math.floor(reward * (this.soulGainMul || 1));
  }

  gameOver() {
    this.state = 'gameover';
    const reward = this.computeSoulReward();
    addSouls(reward);
    this.runSouls = reward;
    this.totalSouls = loadSouls().balance;
    this.ui.showGameOver();
    this.audio.gameover();
  }

  renderBackdropOnly() {
    this.ctx.fillStyle = '#0d0a1a';
    this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
  }

  renderDecals(ctx, cam) {
    const w = CONFIG.LOGICAL_WIDTH;
    const h = CONFIG.LOGICAL_HEIGHT;
    // 各装饰以底部为锚点的绘制高度（像素），乘以随机缩放 d.s
    const BASE_H = [30, 34, 16, 12, 18];
    const KEYS = ['tomb', 'wood', 'rubble', 'bone', 'cross'];
    ctx.save();
    for (const d of this.decals) {
      const sx = d.x - cam.ox;
      const sy = d.y - cam.oy;
      if (sx < -60 || sy < -60 || sx > w + 60 || sy > h + 60) continue;
      const img = sprite(KEYS[d.kind]);
      ctx.save();
      ctx.translate(sx, sy);
      if (d.flip) ctx.scale(-1, 1);
      if (img) {
        // 带体积光的 PNG 精灵：底部锚定、按 d.s 缩放
        const dh = BASE_H[d.kind] * d.s;
        const dw = dh * img.width / img.height;
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
      } else {
        // 素材未加载时的兜底（保持旧纯色程序化绘制，避免空白）
        ctx.scale(d.s, d.s);
        ctx.fillStyle = 'rgba(16, 11, 28, 0.9)';
        if (d.kind === 0) {
          ctx.fillRect(-7, -16, 14, 18);
          ctx.beginPath();
          ctx.arc(0, -16, 7, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(-2, -22, 4, 6);
        } else if (d.kind === 1) {
          ctx.fillRect(-2, -22, 4, 24);
          ctx.fillRect(-9, -18, 8, 3);
          ctx.fillRect(1, -26, 9, 3);
        } else if (d.kind === 2) {
          ctx.beginPath();
          ctx.arc(-5, 0, 4, 0, Math.PI * 2);
          ctx.arc(3, -2, 5, 0, Math.PI * 2);
          ctx.arc(8, 1, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (d.kind === 3) {
          // 枯骨兜底（素材未加载时）
          ctx.fillRect(-8, -2, 16, 2);
          ctx.fillRect(-6, 1, 12, 2);
        } else {
          // 小十字架兜底
          ctx.fillRect(-1, -10, 2, 12);
          ctx.fillRect(-4, -4, 8, 2);
        }
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

    // 暗夜氛围边缘暗角（离屏缓存，避免每帧 createRadialGradient）
    if (!this._vignetteCanvas) {
      const vc = document.createElement('canvas');
      vc.width = CONFIG.LOGICAL_WIDTH;
      vc.height = CONFIG.LOGICAL_HEIGHT;
      const vctx = vc.getContext('2d');
      const grad = vctx.createRadialGradient(
        CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2, CONFIG.LOGICAL_HEIGHT * 0.42,
        CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2, CONFIG.LOGICAL_HEIGHT * 0.95,
      );
      grad.addColorStop(0, 'rgba(6,4,16,0)');
      grad.addColorStop(1, 'rgba(6,4,16,0.55)');
      vctx.fillStyle = grad;
      vctx.fillRect(0, 0, vc.width, vc.height);
      this._vignetteCanvas = vc;
    }
    ctx.drawImage(this._vignetteCanvas, 0, 0);
  }
}
