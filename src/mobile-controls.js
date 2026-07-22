// 手机端触屏控件：浮动摇杆（左半屏全域触摸）+ 触屏暂停按钮（右上）
// 借鉴吸血鬼幸存者手游竖屏操作：手指按下哪里摇杆就在哪里出现，松手隐藏，不遮挡视野
// 仅在触屏设备激活，桌面端不渲染
export class MobileControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.joyActive = false;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 50; // 摇杆拖动限幅半径（决定触发最大移动的拖动距离）
    this.buildDom();
  }

  buildDom() {
    // 防御：移除可能存在的旧元素（防止重复实例化导致 ID 冲突）
    document.getElementById('touch-zone')?.remove();
    document.getElementById('joystick-base')?.remove();
    document.getElementById('touch-pause-btn')?.remove();

    // 触摸层：覆盖左半屏，接收 pointerdown 触发浮动摇杆
    // 用透明 div 而非绑在 canvas 上，避免和游戏渲染事件冲突
    this.touchZone = document.createElement('div');
    this.touchZone.id = 'touch-zone';
    this.touchZone.classList.add('hidden');

    // 浮动摇杆：base 圆盘 + thumb 中心点，默认隐藏，pointerdown 时定位到按下点
    this.joyBase = document.createElement('div');
    this.joyBase.id = 'joystick-base';
    this.joyThumb = document.createElement('div');
    this.joyThumb.id = 'joystick-thumb';
    this.joyBase.appendChild(this.joyThumb);
    // 初始隐藏，由 pointerdown 触发显示
    this.joyBase.style.display = 'none';

    // 触屏暂停按钮
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.id = 'touch-pause-btn';
    this.pauseBtn.classList.add('hidden');
    this.pauseBtn.setAttribute('aria-label', '暂停');
    this.pauseBtn.textContent = '⏸';

    document.getElementById('app').append(this.touchZone, this.joyBase, this.pauseBtn);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.touchZone.classList.remove('hidden');
    this.pauseBtn.classList.remove('hidden');

    // 触摸层 pointer 事件：浮动摇杆核心逻辑
    this._onDown = (e) => this.handleDown(e);
    this._onMove = (e) => this.handleMove(e);
    this._onUp = (e) => this.handleUp(e);
    this.touchZone.addEventListener('pointerdown', this._onDown);
    this.touchZone.addEventListener('pointermove', this._onMove);
    this.touchZone.addEventListener('pointerup', this._onUp);
    this.touchZone.addEventListener('pointercancel', this._onUp);

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
    this.touchZone.classList.add('hidden');
    this.pauseBtn.classList.add('hidden');
    this.touchZone.removeEventListener('pointerdown', this._onDown);
    this.touchZone.removeEventListener('pointermove', this._onMove);
    this.touchZone.removeEventListener('pointerup', this._onUp);
    this.touchZone.removeEventListener('pointercancel', this._onUp);
    this.pauseBtn.removeEventListener('click', this._onPauseClick);
    this.game.input.setVirtualInput(0, 0);
    this.hideJoystick();
  }

  destroy() {
    this.disable();
    this.touchZone.remove();
    this.joyBase.remove();
    this.pauseBtn.remove();
  }

  // 浮动摇杆：按下时记录起点，摇杆 base 移动到按下位置并显示
  handleDown(e) {
    // 游戏未进行时不响应（避免标题页/升级界面误触）
    if (this.game.state !== 'playing') return;
    this.joyActive = true;
    this.joyCenter = { x: e.clientX, y: e.clientY };
    // 摇杆 base 定位到按下点（以按下点为中心）
    this.joyBase.style.left = `${e.clientX}px`;
    this.joyBase.style.top = `${e.clientY}px`;
    this.joyBase.style.display = 'flex';
    // 锁定指针，确保后续 move/up 都发到 touchZone
    this.touchZone.setPointerCapture(e.pointerId);
    this.updateJoy(e.clientX, e.clientY);
  }

  handleMove(e) {
    if (!this.joyActive) return;
    this.updateJoy(e.clientX, e.clientY);
  }

  handleUp(e) {
    if (!this.joyActive) return;
    this.joyActive = false;
    try { this.touchZone.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    this.game.input.setVirtualInput(0, 0);
    this.hideJoystick();
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
    // 视觉位移（thumb 相对 base 中心移动）
    this.joyThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    // 归一化向量写入 Input
    const nx = this.joyRadius > 0 ? dx / this.joyRadius : 0;
    const ny = this.joyRadius > 0 ? dy / this.joyRadius : 0;
    this.game.input.setVirtualInput(nx, ny);
  }

  hideJoystick() {
    this.joyBase.style.display = 'none';
    this.joyThumb.style.transform = 'translate(0, 0)';
  }
}
