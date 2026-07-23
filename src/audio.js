// WebAudio 音效管理：用振荡器实时合成芯片音，零音频资源依赖（契合像素美术风格）
// 默认静音：仅当用户显式开启过（localStorage 记忆）才发声
const STORAGE_KEY = 'ns_audio_enabled';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    // 默认静音：未开启过则等于 false（不读 localStorage 即 false）
    this.enabled = localStorage.getItem(STORAGE_KEY) === '1';
    this._lastKillAt = 0;
  }

  // 懒创建 AudioContext（浏览器自动播放策略要求必须在用户手势后才能 resume）
  ensureCtx() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22; // 主音量，避免刺耳
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* 忽略：下次手势再尝试 */ });
    }
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* 隐私模式忽略 */ }
    if (on) this.ensureCtx();
  }

  // 切换开关，返回最新状态
  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // 基础发声：单个振荡器 + 音量包络（快速起音、指数衰减）
  blip({ type = 'square', f0 = 440, f1 = 0, dur = 0.1, vol = 1, delay = 0 }) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, f0), t0);
    if (f1 > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // 拾取经验宝石：高频上扬短音，随机音高避免机械感
  pickup() {
    this.blip({ type: 'sine', f0: 640 + Math.random() * 160, f1: 1050, dur: 0.08, vol: 0.45 });
  }

  // 击杀：极短低音量滴答，节流防止刷屏
  kill() {
    const now = performance.now();
    if (now - this._lastKillAt < 90) return;
    this._lastKillAt = now;
    this.blip({ type: 'square', f0: 300 + Math.random() * 90, f1: 170, dur: 0.05, vol: 0.16 });
  }

  // 受击：低频下坠闷响
  hit() {
    this.blip({ type: 'sawtooth', f0: 170, f1: 55, dur: 0.16, vol: 0.85 });
  }

  // 升级：大三和弦琶音
  levelup() {
    const notes = [523, 659, 784];
    notes.forEach((f, i) => this.blip({ type: 'triangle', f0: f, dur: 0.14, vol: 0.6, delay: i * 0.09 }));
  }

  // Boss 预警：两声低沉号角
  bossWarning() {
    this.blip({ type: 'sawtooth', f0: 110, f1: 82, dur: 0.4, vol: 0.9 });
    this.blip({ type: 'sawtooth', f0: 98, f1: 73, dur: 0.5, vol: 0.9, delay: 0.32 });
  }

  // 宝箱：快速上行琶音
  chest() {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => this.blip({ type: 'square', f0: f, dur: 0.09, vol: 0.4, delay: i * 0.06 }));
  }

  // 神器进化：上行琶音 + 高音余韵
  evolve() {
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((f, i) => this.blip({ type: 'triangle', f0: f, dur: 0.16, vol: 0.55, delay: i * 0.08 }));
    this.blip({ type: 'sine', f0: 1568, f1: 2093, dur: 0.4, vol: 0.3, delay: 0.45 });
  }

  // 游戏结束：下行小调乐句
  gameover() {
    const notes = [392, 311, 262, 196];
    notes.forEach((f, i) => this.blip({ type: 'triangle', f0: f, dur: 0.3, vol: 0.6, delay: i * 0.22 }));
  }

  // UI 点击
  uiClick() {
    this.blip({ type: 'square', f0: 880, dur: 0.05, vol: 0.25 });
  }

  // 雷霆命中：电裂短音（节流防 stormcall 一次 6 连刷屏）
  zap() {
    const now = performance.now();
    if (now - (this._lastZapAt || 0) < 70) return;
    this._lastZapAt = now;
    this.blip({ type: 'square', f0: 900 + Math.random() * 200, f1: 180, dur: 0.12, vol: 0.5 });
    this.blip({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.1, vol: 0.3, delay: 0.01 });
  }

  // 圣水落瓶：水花轻响
  splash() {
    this.blip({ type: 'sine', f0: 520, f1: 240, dur: 0.14, vol: 0.4 });
    this.blip({ type: 'triangle', f0: 300, f1: 160, dur: 0.1, vol: 0.25, delay: 0.03 });
  }
}
