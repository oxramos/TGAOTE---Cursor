export class Input {
  keys = new Set<string>();
  virtual = new Set<string>();
  stick = { x: 0, z: 0 };
  dx = 0;
  dy = 0;
  dragging = false;
  wheel = 0;
  pointer = { x: 0, y: 0 };
  ndc = { x: 0, y: 0 };
  click = false;
  clickNdc = { x: 0, y: 0 };
  justPressed = new Set<string>();
  private tapQueue: string[] = [];

  private lookId: number | null = null;
  private lookMoved = 0;
  private lastLookX = 0;
  private lastLookY = 0;
  private canvasPtrs = new Map<number, { x: number; y: number }>();
  private pinch0 = 0;
  private stickId: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    window.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.style.touchAction = "none";
    this.armTouchMode();
    this.bindTouchHud();
  }

  private armTouchMode() {
    const on = () => document.documentElement.classList.add("touch-on");
    if (navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches) on();
    window.addEventListener("touchstart", on, { passive: true });
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "Tab", "ShiftLeft", "ShiftRight"].includes(k)) e.preventDefault();
    if (!this.keys.has(k) && !this.virtual.has(k)) this.justPressed.add(k);
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onDown = (e: PointerEvent) => {
    if (e.target !== this.canvas) return;
    this.canvasPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.updatePointer(e);
    if (this.canvasPtrs.size >= 2) {
      this.lookId = null;
      this.dragging = false;
      this.pinch0 = this.pinchGap();
      return;
    }
    this.lookId = e.pointerId;
    this.dragging = true;
    this.lastLookX = e.clientX;
    this.lastLookY = e.clientY;
    this.lookMoved = 0;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* iOS Safari can ignore capture; client deltas still work */
    }
  };

  private onUp = (e: PointerEvent) => {
    const wasLook = e.pointerId === this.lookId;
    this.canvasPtrs.delete(e.pointerId);
    if (wasLook) {
      if (this.lookMoved < 10) {
        this.click = true;
        this.clickNdc = { ...this.ndc };
      }
      this.lookId = null;
      this.dragging = false;
      this.dx = 0;
      this.dy = 0;
    }
    if (this.canvasPtrs.size === 1) {
      const [id, p] = [...this.canvasPtrs.entries()][0];
      this.lookId = id;
      this.dragging = true;
      this.lastLookX = p.x;
      this.lastLookY = p.y;
      this.lookMoved = 999;
    }
    this.pinch0 = this.canvasPtrs.size >= 2 ? this.pinchGap() : 0;
  };

  private onMove = (e: PointerEvent) => {
    if (this.canvasPtrs.has(e.pointerId)) {
      this.canvasPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this.canvasPtrs.size >= 2) {
      const gap = this.pinchGap();
      if (this.pinch0 > 0) this.wheel += (this.pinch0 - gap) * 1.2;
      this.pinch0 = gap;
      return;
    }
    if (e.pointerId !== this.lookId) return;
    this.updatePointer(e);
    let mx = e.movementX;
    let my = e.movementY;
    if (mx === 0 && my === 0) {
      mx = e.clientX - this.lastLookX;
      my = e.clientY - this.lastLookY;
    }
    this.lastLookX = e.clientX;
    this.lastLookY = e.clientY;
    this.dx += mx;
    this.dy += my;
    this.lookMoved += Math.hypot(mx, my);
  };

  private onWheel = (e: WheelEvent) => {
    this.wheel += e.deltaY;
  };

  private pinchGap() {
    const pts = [...this.canvasPtrs.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private updatePointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  private bindTouchHud() {
    const stick = document.getElementById("touch-stick");
    const knob = document.getElementById("touch-stick-knob");
    if (stick && knob) {
      const max = 48;
      const dead = 0.16;
      const setFrom = (cx: number, cy: number) => {
        const r = stick.getBoundingClientRect();
        let dx = cx - (r.left + r.width / 2);
        let dy = cy - (r.top + r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const nx = dx / max;
        const nz = dy / max;
        this.stick.x = Math.abs(nx) < dead ? 0 : nx;
        this.stick.z = Math.abs(nz) < dead ? 0 : nz;
      };
      const clearStick = () => {
        this.stickId = null;
        this.stick.x = 0;
        this.stick.z = 0;
        knob.style.transform = "translate(0, 0)";
        stick.classList.remove("is-down");
      };
      stick.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stickId = e.pointerId;
        stick.classList.add("is-down");
        try {
          stick.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        setFrom(e.clientX, e.clientY);
      });
      stick.addEventListener("pointermove", (e) => {
        if (e.pointerId !== this.stickId) return;
        e.preventDefault();
        setFrom(e.clientX, e.clientY);
      });
      stick.addEventListener("pointerup", (e) => {
        if (e.pointerId !== this.stickId) return;
        clearStick();
      });
      stick.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== this.stickId) return;
        clearStick();
      });
    }

    const bindHold = (id: string, code: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        el.classList.add("is-down");
        this.holdVirtual(code);
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("is-down");
        this.releaseVirtual(code);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    };

    const bindTap = (id: string, code: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add("is-down");
        this.tapVirtual(code);
      });
      const clear = () => el.classList.remove("is-down");
      el.addEventListener("pointerup", clear);
      el.addEventListener("pointercancel", clear);
      el.addEventListener("pointerleave", clear);
    };

    bindHold("touch-jump", "Space");
    bindHold("touch-sprint", "ShiftLeft");
    bindHold("touch-look", "KeyF");
    bindTap("touch-go", "KeyE");
    bindTap("touch-bag", "Tab");
    bindTap("touch-pause", "Escape");
    bindTap("touch-decor", "KeyQ");
  }

  holdVirtual(code: string) {
    if (!this.virtual.has(code) && !this.keys.has(code)) this.tapQueue.push(code);
    this.virtual.add(code);
  }

  releaseVirtual(code: string) {
    this.virtual.delete(code);
  }

  tapVirtual(code: string) {
    this.tapQueue.push(code);
  }

  pressed(code: string) {
    return this.keys.has(code) || this.virtual.has(code);
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
  beginFrame() {
    for (const code of this.tapQueue) this.justPressed.add(code);
    this.tapQueue.length = 0;
  }

  endFrame() {
    this.justPressed.clear();
  }

  moveAxis(): { x: number; z: number } {
    let x = this.stick.x;
    let z = this.stick.z;
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
