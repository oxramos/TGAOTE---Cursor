import * as THREE from "three";
import { ITEMS } from "./catalog";
import { createItemVisual } from "./models/items";

export class InspectView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  pivot = new THREE.Group();
  dragging = false;
  lastX = 0;
  lastY = 0;
  active = false;
  uniforms: THREE.ShaderMaterial[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color("#102a44");
    this.camera.position.set(0, 0.35, 2.4);
    this.scene.add(new THREE.HemisphereLight(0xfff1d0, 0x1a3a58, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    this.scene.add(this.pivot);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.01, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.4 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.45;
    this.scene.add(ring);

    canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", () => (this.dragging = false));
    canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.pivot.rotation.y += (e.clientX - this.lastX) * 0.01;
      this.pivot.rotation.x += (e.clientY - this.lastY) * 0.008;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
  }

  show(itemId: string) {
    this.active = true;
    this.pivot.clear();
    this.uniforms = [];
    const vis = createItemVisual(itemId);
    vis.scale.setScalar(1.6);
    vis.position.y = 0.1;
    vis.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material && (m.material as THREE.ShaderMaterial).uniforms?.uTime) {
        this.uniforms.push(m.material as THREE.ShaderMaterial);
      }
    });
    this.pivot.add(vis);
    const def = ITEMS[itemId];
    if (def?.rarity === "legendary") {
      vis.add(new THREE.PointLight(def.glow ?? def.color, 1.4, 6));
    }
    this.resize();
  }

  hide() {
    this.active = false;
    this.pivot.clear();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || 480;
    const h = c.clientHeight || 520;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  render(t: number) {
    if (!this.active) return;
    this.pivot.rotation.y += 0.004;
    for (const u of this.uniforms) u.uniforms.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
  }
}
