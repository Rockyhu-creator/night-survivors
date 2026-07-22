// 手机端触屏控件：虚拟摇杆（左下）+ 触屏暂停按钮（右上）
// 仅在触屏设备激活，桌面端不渲染
export class MobileControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.joyActive = false;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 40; // 摇杆拖动限幅半径
    this.buildDom();
  }

  buildDom() {
    // 防御：移除可能存在的旧元素（防止重复实例化导致 ID 冲突）
    document.getElementById('joystick-base')?.remove();
    document.getElementById('touch-pause-btn')?.remove();

    // 虚拟摇杆：base 圆盘 + thumb 中心点
    this.joyBase = document.createElement('div');
    this.joyBase.id = 'joystick-base';
    this.joyThumb = document.createElement('div');
    this.joyThumb.id = 'joystick-thumb';
    this.joyBase.appendChild(this.joyThumb);
    this.joyBase.classList.add('hidden');

    // 触屏暂停按钮
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.id = 'touch-pause-btn';
    this.pauseBtn.classList.add('hidden');
    this.pauseBtn.setAttribute('aria-label', '暂停');
    this.pauseBtn.textContent = '⏸';

    document.getElementById('app').append(this.joyBase, this.pauseBtn);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.joyBase.classList.remove('hidden');
    this.pauseBtn.classList.remove('hidden');

    // 摇杆 pointer 事件
    this._onJoyDown = (e) => this.handleJoyDown(e);
    this._onJoyMove = (e) => this.handleJoyMove(e);
    this._onJoyUp = (e) => this.handleJoyUp(e);
    this.joyBase.addEventListener('pointerdown', this._onJoyDown);
    this.joyBase.addEventListener('pointermove', this._onJoyMove);
    this.joyBase.addEventListener('pointerup', this._onJoyUp);
    this.joyBase.addEventListener('pointercancel', this._onJoyUp);

    // 暂停按钮
    this._onPauseClick = () => {
      if (this.game.state === 'playing' || this.game.state === 'paused') {
        this.game.togglePause();
      }
    };
    this.pauseBtn.addEventListener('click', this._onPauseClick);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.joyBase.classList.add('hidden');
    this.pauseBtn.classList.add('hidden');
    this.joyBase.removeEventListener('pointerdown', this._onJoyDown);
    this.joyBase.removeEventListener('pointermove', this._onJoyMove);
    this.joyBase.removeEventListener('pointerup', this._onJoyUp);
    this.joyBase.removeEventListener('pointercancel', this._onJoyUp);
    this.pauseBtn.removeEventListener('click', this._onPauseClick);
    this.game.input.setVirtualInput(0, 0);
    this.resetThumb();
  }

  destroy() {
    this.disable();
    this.joyBase.remove();
    this.pauseBtn.remove();
  }

  handleJoyDown(e) {
    this.joyActive = true;
    const rect = this.joyBase.getBoundingClientRect();
    this.joyCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.joyBase.setPointerCapture(e.pointerId);
    this.updateJoy(e.clientX, e.clientY);
  }

  handleJoyMove(e) {
    if (!this.joyActive) return;
    this.updateJoy(e.clientX, e.clientY);
  }

  handleJoyUp(e) {
    if (!this.joyActive) return;
    this.joyActive = false;
    try { this.joyBase.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    this.game.input.setVirtualInput(0, 0);
    this.resetThumb();
  }

  updateJoy(clientX, clientY) {
    let dx = clientX - this.joyCenter.x;
    let dy = clientY - this.joyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 限幅到 joyRadius
    if (dist > this.joyRadius) {
      const scale = this.joyRadius / dist;
      dx *= scale;
      dy *= scale;
    }
    // 视觉位移
    this.joyThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    // 归一化向量写入 Input
    const nx = this.joyRadius > 0 ? dx / this.joyRadius : 0;
    const ny = this.joyRadius > 0 ? dy / this.joyRadius : 0;
    this.game.input.setVirtualInput(nx, ny);
  }

  resetThumb() {
    this.joyThumb.style.transform = 'translate(0, 0)';
  }
}
