export class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }
}

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  follow(target, w, h, dt) {
    const k = 1 - Math.pow(0.0015, dt);
    this.x += (target.x - w / 2 - this.x) * k;
    this.y += (target.y - h / 2 - this.y) * k;
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    const mag = this.trauma * this.trauma * 14;
    this.shakeX = (Math.random() * 2 - 1) * mag;
    this.shakeY = (Math.random() * 2 - 1) * mag;
  }

  addShake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get ox() { return this.x + this.shakeX; }
  get oy() { return this.y + this.shakeY; }
}
