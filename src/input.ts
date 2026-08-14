export class Input {
  keys = new Set<string>();
  dx = 0;
  dy = 0;
  dragging = false;
  wheel = 0;
  pointer = { x: 0, y: 0 };
  ndc = { x: 0, y: 0 };
  click = false;
  clickNdc = { x: 0, y: 0 };
  justPressed = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "Tab"].includes(k)) e.preventDefault();
    if (!this.keys.has(k)) this.justPressed.add(k);
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.updatePointer(e);
  };
  private onUp = (e: PointerEvent) => {
    if (this.dragging && Math.hypot(this.dx, this.dy) < 4) {
      this.click = true;
      this.clickNdc = { ...this.ndc };
    }
    this.dragging = false;
    this.dx = 0;
    this.dy = 0;
  };
  private onMove = (e: PointerEvent) => {
    this.updatePointer(e);
    if (this.dragging) {
      this.dx += e.movementX;
      this.dy += e.movementY;
    }
  };
  private onWheel = (e: WheelEvent) => {
    this.wheel += e.deltaY;
  };

  private updatePointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  pressed(code: string) {
    return this.keys.has(code);
  }
  consume(code: string) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }
  consumeClick() {
    const c = this.click;
    this.click = false;
    return c;
  }
  mouseDelta() {
    const x = this.dx;
    const y = this.dy;
    this.dx = 0;
    this.dy = 0;
    return { x, y };
  }
  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
  endFrame() {
    this.justPressed.clear();
  }

  moveAxis(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.pressed("KeyA") || this.pressed("ArrowLeft")) x -= 1;
    if (this.pressed("KeyD") || this.pressed("ArrowRight")) x += 1;
    if (this.pressed("KeyW") || this.pressed("ArrowUp")) z -= 1;
    if (this.pressed("KeyS") || this.pressed("ArrowDown")) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }
}
