import * as THREE from "three";
import { PALETTE, toon, outlineClone } from "../materials";

export type HouseKind = "home" | "mallow" | "pebble" | "coral" | "brine";

export function createHouse(kind: HouseKind): THREE.Group {
  const g = new THREE.Group();
  g.name = `house-${kind}`;
  if (kind === "home") g.add(homeCottage());
  if (kind === "mallow") g.add(woolCottage());
  if (kind === "pebble") g.add(stoneLibrary());
  if (kind === "coral") g.add(stiltShop());
  if (kind === "brine") g.add(boatHouse());
  return g;
}

const texCache = new Map<string, THREE.CanvasTexture>();

function canvasTex(key: string, draw: (ctx: CanvasRenderingContext2D, s: number) => void, size = 256): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function hexRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function clapboard(hex: number): THREE.CanvasTexture {
  return canvasTex(`clap-${hex}`, (ctx, s) => {
    const [r, g, b] = hexRgb(hex);
    for (let y = 0; y < s; y += 18) {
      const t = (Math.floor(y / 18) % 2 === 0 ? 1 : 0.9) * (0.97 + (y % 36) * 0.001);
      ctx.fillStyle = `rgb(${Math.round(r * t)},${Math.round(g * t)},${Math.round(b * t)})`;
      ctx.fillRect(0, y, s, 16);
      ctx.fillStyle = "rgba(90,45,20,0.28)";
      ctx.fillRect(0, y + 16, s, 2);
    }
  });
}

function shingles(hex: number): THREE.CanvasTexture {
  return canvasTex(`shin-${hex}`, (ctx, s) => {
    const [r, g, b] = hexRgb(hex);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 20) {
      const odd = Math.floor(y / 20) % 2;
      for (let x = -20; x < s; x += 28) {
        const xx = x + (odd ? 14 : 0);
        const t = 0.82 + ((x + y) % 7) * 0.03;
        ctx.fillStyle = `rgb(${Math.round(r * t)},${Math.round(g * t)},${Math.round(b * t)})`;
        ctx.beginPath();
        ctx.moveTo(xx + 14, y + 2);
        ctx.lineTo(xx + 26, y + 16);
        ctx.lineTo(xx + 14, y + 20);
        ctx.lineTo(xx + 2, y + 16);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(40,10,12,0.35)";
        ctx.stroke();
      }
    }
  });
}

function stoneBlocks(hex: number): THREE.CanvasTexture {
  return canvasTex(`stone-${hex}`, (ctx, s) => {
    const [r, g, b] = hexRgb(hex);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 28) {
      const odd = Math.floor(y / 28) % 2;
      for (let x = -20; x < s; x += 40) {
        const xx = x + (odd ? 20 : 0);
        const t = 0.88 + ((x * 3 + y) % 9) * 0.02;
        ctx.fillStyle = `rgb(${Math.round(r * t)},${Math.round(g * t)},${Math.round(b * t)})`;
        ctx.fillRect(xx + 2, y + 2, 36, 24);
        ctx.strokeStyle = "rgba(50,45,40,0.45)";
        ctx.strokeRect(xx + 2, y + 2, 36, 24);
      }
    }
  });
}

function planks(hex: number): THREE.CanvasTexture {
  return canvasTex(`plank-${hex}`, (ctx, s) => {
    const [r, g, b] = hexRgb(hex);
    for (let x = 0; x < s; x += 22) {
      const t = 0.88 + ((x / 22) % 3) * 0.05;
      ctx.fillStyle = `rgb(${Math.round(r * t)},${Math.round(g * t)},${Math.round(b * t)})`;
      ctx.fillRect(x, 0, 20, s);
      ctx.fillStyle = "rgba(40,22,10,0.35)";
      ctx.fillRect(x + 20, 0, 2, s);
      for (let y = 18; y < s; y += 46) {
        ctx.fillRect(x + 6, y, 8, 2);
      }
    }
  });
}

function texMat(map: THREE.CanvasTexture, tint = 0xffffff, opts?: { emissive?: number }): THREE.MeshToonMaterial {
  const m = toon(tint, { map, emissive: opts?.emissive });
  return m;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function tbox(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function heartShape(s = 1): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, s * 0.35);
  sh.bezierCurveTo(-s * 0.15, s * 0.7, -s * 0.7, s * 0.55, -s * 0.7, s * 0.1);
  sh.bezierCurveTo(-s * 0.7, -s * 0.25, 0, -s * 0.55, 0, -s * 0.85);
  sh.bezierCurveTo(0, -s * 0.55, s * 0.7, -s * 0.25, s * 0.7, s * 0.1);
  sh.bezierCurveTo(s * 0.7, s * 0.55, s * 0.15, s * 0.7, 0, s * 0.35);
  return sh;
}

function pitchedRoof(width: number, depth: number, rise: number, color: number, overhang = 0.48): THREE.Group {
  const g = new THREE.Group();
  const extra = overhang;
  const hypot = Math.hypot(width / 2, rise);
  const slopeLen = hypot + extra;
  const angle = Math.atan2(rise, width / 2);
  const cx = width / 4 + Math.cos(angle) * extra * 0.5;
  const cy = rise / 2 - Math.sin(angle) * extra * 0.5;
  const mat = texMat(shingles(color));
  const under = toon(0x6a1218);

  for (const side of [-1, 1] as const) {
    const panel = tbox(slopeLen, 0.26, depth + overhang * 2, mat, side * cx, cy, 0);
    panel.rotation.z = side === -1 ? angle : -angle;
    g.add(panel);
    const soffit = tbox(slopeLen * 0.98, 0.04, depth + overhang * 1.6, under, side * cx, cy - 0.12, 0);
    soffit.rotation.z = panel.rotation.z;
    g.add(soffit);
  }

  g.add(box(0.18, 0.16, depth + overhang * 2 + 0.1, 0x7a151c, 0, rise + 0.06, 0));

  const fascia = 0x7a151c;
  for (const z of [-depth / 2 - overhang * 0.2, depth / 2 + overhang * 0.2]) {
    for (const side of [-1, 1] as const) {
      const board = box(slopeLen + 0.06, 0.1, 0.09, fascia, side * cx, cy, z);
      board.rotation.z = side === -1 ? angle : -angle;
      g.add(board);
    }
  }
  return g;
}

function gableWall(width: number, rise: number, mat: THREE.Material): THREE.Mesh {
  const sh = new THREE.Shape();
  sh.moveTo(-width / 2, 0);
  sh.lineTo(width / 2, 0);
  sh.lineTo(0, rise);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false });
  geo.translate(0, 0, -0.09);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function prettyWindow(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w = 0.82,
  h = 1.0,
  rotY = 0,
  withBox = true,
  shutter = 0xc41f28,
) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;

  root.add(box(w + 0.28, h + 0.28, 0.08, 0x7a1c22, 0, 0, -0.02));
  root.add(box(w + 0.18, h + 0.18, 0.1, 0xfff6ea, 0, 0, 0.02));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.02, h - 0.02),
    toon(0xf4b3c8, { emissive: 0xe89ab0 }),
  );
  glass.position.z = 0.08;
  root.add(glass);
  root.add(box(0.06, h - 0.08, 0.07, 0xfff6ea, 0, 0, 0.1));
  root.add(box(w - 0.08, 0.06, 0.07, 0xfff6ea, 0, 0, 0.1));
  root.add(box(w + 0.32, 0.1, 0.22, 0xfff1dc, 0, -h / 2 - 0.08, 0.06));

  if (shutter) {
    root.add(box(0.16, h + 0.06, 0.05, shutter, -w / 2 - 0.2, 0, 0.04));
    root.add(box(0.16, h + 0.06, 0.05, shutter, w / 2 + 0.2, 0, 0.04));
  }

  if (withBox) {
    root.add(box(w + 0.34, 0.18, 0.26, PALETTE.wood, 0, -h / 2 - 0.2, 0.16));
    const blooms = [0xe56b9e, 0xf2c14e, 0xff8ba7, 0x7bc47a];
    blooms.forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), toon(col));
      f.position.set(-w * 0.32 + i * 0.22, -h / 2 - 0.04, 0.22);
      root.add(f);
    });
  }
  parent.add(root);
}

function steps(parent: THREE.Group, x: number, z: number, yaw = 0, count = 4) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.add(box(1.55, 0.22, 0.12, PALETTE.woodDeep, -0.72, 0.45, -0.15));
  g.add(box(1.55, 0.22, 0.12, PALETTE.woodDeep, 0.72, 0.45, -0.15));
  for (let i = 0; i < count; i++) {
    const w = 1.45 - i * 0.02;
    g.add(box(w, 0.13, 0.34, PALETTE.stone, 0, 0.08 + i * 0.13, 0.18 - i * 0.3));
  }
  parent.add(g);
}

function bush(parent: THREE.Group, x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const cols = [PALETTE.grass, PALETTE.grassDeep, PALETTE.grassTip];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 10, 8), toon(cols[i % 3]));
    s.position.set((i - 2.4) * 0.13 * scale, 0.26 * scale + (i % 2) * 0.1, (i % 3) * 0.07);
    s.castShadow = true;
    g.add(s);
  }
  const flower = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), toon(0xff8ba7));
  flower.position.set(0.08, 0.52 * scale, 0.1);
  g.add(flower);
  parent.add(g);
}

function lantern(parent: THREE.Group, x: number, y: number, z: number) {
  parent.add(cyl(0.025, 0.025, 0.22, PALETTE.woodDeep, x, y + 0.14, z, 6));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  lamp.position.set(x, y, z);
  parent.add(lamp);
}

function homeCottage(): THREE.Group {
  const g = new THREE.Group();
  const cream = PALETTE.cottage;
  const roof = PALETTE.roof;
  const siding = texMat(clapboard(cream));
  const stone = texMat(stoneBlocks(PALETTE.stone));

  g.add(tbox(5.7, 0.55, 4.85, stone, 0, 0.24, -0.05));
  for (const x of [-2.65, 2.65]) {
    for (const z of [-2.2, 2.15]) g.add(tbox(0.32, 0.7, 0.32, stone, x, 0.32, z));
  }

  const lower = tbox(5.15, 2.55, 4.2, siding, 0, 1.5, 0);
  g.add(lower, outlineClone(lower, 0.012));
  g.add(box(5.35, 0.16, 4.38, roof, 0, 2.78, 0));
  g.add(box(5.22, 0.06, 4.28, 0xfff1dc, 0, 2.68, 0));

  const upper = tbox(4.45, 1.85, 3.65, siding, 0, 3.7, -0.06);
  g.add(upper);

  for (const x of [-2.5, 2.5]) {
    g.add(box(0.14, 2.5, 0.14, 0xfff1dc, x, 1.5, 2.05));
    g.add(box(0.14, 2.5, 0.14, 0xfff1dc, x, 1.5, -2.05));
  }

  const roofY = 4.58;
  const roofG = pitchedRoof(5.45, 4.2, 2.05, roof, 0.42);
  roofG.position.y = roofY;
  g.add(roofG);
  const gableF = gableWall(4.45, 1.65, siding);
  gableF.position.set(0, roofY, 1.74);
  const gableB = gableWall(4.45, 1.65, siding);
  gableB.position.set(0, roofY, -1.86);
  g.add(gableF, gableB);

  const brick = texMat(stoneBlocks(0xb85a4a));
  g.add(tbox(0.55, 1.55, 0.55, brick, 1.65, 5.75, -0.55));
  g.add(box(0.7, 0.12, 0.7, PALETTE.stoneDeep, 1.65, 6.52, -0.55));
  g.add(box(0.22, 0.28, 0.22, 0x6a4038, 1.65, 6.72, -0.55));
  const vane = box(0.04, 0.45, 0.04, 0xf2c14e, 0, 6.72, 0);
  g.add(vane);
  const hg = new THREE.ExtrudeGeometry(heartShape(0.14), { depth: 0.04, bevelEnabled: false });
  hg.center();
  const vaneH = new THREE.Mesh(hg, toon(0xe23a3a));
  vaneH.position.set(0.16, 6.88, 0);
  g.add(vaneH);
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 + i * 0.04, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0.32 - i * 0.06, depthWrite: false }),
    );
    puff.name = "chimney-puff";
    puff.userData = { phase: i * 1.1, baseY: 6.9 + i * 0.24 };
    puff.position.set(1.65 + i * 0.05, 6.9 + i * 0.24, -0.55);
    g.add(puff);
  }

  prettyWindow(g, -1.48, 1.58, 2.16);
  prettyWindow(g, 1.48, 1.58, 2.16);
  prettyWindow(g, -0.78, 3.72, 1.8, 0.72, 0.86, 0, false);
  prettyWindow(g, 0.78, 3.72, 1.8, 0.72, 0.86, 0, false);
  prettyWindow(g, -2.62, 1.58, 0.15, 0.72, 0.92, Math.PI / 2, true);
  prettyWindow(g, 2.62, 1.58, 0.15, 0.72, 0.92, -Math.PI / 2, true);

  g.add(tbox(2.55, 0.14, 1.55, texMat(planks(PALETTE.wood)), 0, 0.55, 2.7));
  for (const x of [-1.05, 1.05]) {
    g.add(cyl(0.08, 0.09, 1.7, 0xfff6ea, x, 1.38, 3.32, 8));
    g.add(cyl(0.12, 0.13, 0.1, PALETTE.wood, x, 0.58, 3.32, 8));
    g.add(box(0.05, 0.7, 0.05, 0xfff6ea, x, 1.55, 3.05));
  }
  g.add(box(2.2, 0.06, 0.06, PALETTE.roof, 0, 1.92, 3.05));
  const porchRoof = pitchedRoof(2.7, 1.7, 0.92, roof, 0.14);
  porchRoof.position.set(0, 2.28, 2.88);
  g.add(porchRoof);
  const porchGable = gableWall(2.35, 0.72, siding);
  porchGable.position.set(0, 2.28, 3.62);
  g.add(porchGable);

  steps(g, 0, 3.55, 0, 4);

  g.add(box(1.05, 1.7, 0.12, roof, 0, 1.38, 2.16));
  g.add(box(0.82, 0.62, 0.05, 0x9a1c24, 0, 0.98, 2.24));
  const doorHeart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.18), { depth: 0.05, bevelEnabled: false }).center(),
    toon(0xf4b3c8, { emissive: 0xe89ab0 }),
  );
  doorHeart.position.set(0, 1.82, 2.24);
  g.add(doorHeart);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), toon(0xf2c14e));
  knob.position.set(0.34, 1.28, 2.26);
  g.add(knob);

  g.add(tbox(2.2, 0.08, 0.75, texMat(planks(PALETTE.wood)), 0, 2.86, 2.22));
  for (const x of [-0.95, 0.95]) g.add(cyl(0.035, 0.035, 0.58, 0xfff6ea, x, 3.16, 2.48, 6));
  g.add(box(2.15, 0.07, 0.07, PALETTE.roof, 0, 3.44, 2.48));
  for (let i = 0; i < 8; i++) g.add(cyl(0.016, 0.016, 0.52, 0xfff1dc, -0.9 + i * 0.26, 3.14, 2.48, 5));

  lantern(g, -1.22, 1.92, 3.22);

  const mail = box(0.28, 0.22, 0.18, PALETTE.roof, 1.85, 0.85, 2.85);
  g.add(mail);
  g.add(cyl(0.03, 0.03, 0.7, PALETTE.woodDeep, 1.85, 0.4, 2.85, 6));

  for (let i = 0; i < 6; i++) {
    g.add(box(0.08, 0.7, 0.08, 0xfff6ea, -3.1 + i * 0.28, 0.4, 3.15));
    g.add(box(0.28, 0.06, 0.06, PALETTE.roof, -3.1 + i * 0.28, 0.72, 3.15));
  }

  bush(g, -2.55, 2.7, 1.1);
  bush(g, 2.6, 2.55, 0.95);
  bush(g, -2.8, -1.7, 0.9);
  bush(g, 2.7, -1.9, 0.75);

  for (let i = 0; i < 6; i++) {
    const stoneStep = box(0.42 + (i % 2) * 0.1, 0.08, 0.3, PALETTE.stone, (i - 2.5) * 0.1, 0.06, 3.95 + i * 0.34);
    stoneStep.rotation.y = (i - 2) * 0.1;
    g.add(stoneStep);
  }

  const vine = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toon(PALETTE.grass));
  vine.scale.set(0.55, 2.1, 0.4);
  vine.position.set(-2.5, 2.55, 2.0);
  g.add(vine);

  return g;
}

function woolCottage(): THREE.Group {
  const g = new THREE.Group();
  const wool = 0xfff0e8;
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.15, 24, 18), toon(wool));
  body.position.y = 1.85;
  body.scale.set(1.22, 0.98, 1.08);
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.025));
  for (let i = 0; i < 18; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (i % 3) * 0.08, 10, 8), toon(i % 2 ? 0xfff6ea : wool));
    const a = (i / 18) * Math.PI * 2;
    puff.position.set(Math.cos(a) * 1.95, 1.5 + (i % 5) * 0.22, Math.sin(a) * 1.65);
    puff.castShadow = true;
    g.add(puff);
  }
  for (let ring = 0; ring < 4; ring++) {
    const y = 3.15 + ring * 0.28;
    const n = 10 - ring * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1.35 - ring * 0.28;
      const tile = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), toon(0xf4c6d7));
      tile.scale.set(1, 0.45, 1);
      tile.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(tile);
    }
  }
  prettyWindow(g, -0.9, 1.95, 2.05, 0.58, 0.66, 0, false, 0xe56b9e);
  prettyWindow(g, 0.9, 1.95, 2.05, 0.58, 0.66, 0, false, 0xe56b9e);
  g.add(box(0.92, 1.45, 0.14, 0xe56b9e, 0, 0.82, 2.22));
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 6, 16), toon(0x7bc47a));
  wreath.position.set(0, 1.32, 2.32);
  g.add(wreath);
  g.add(cyl(0.34, 0.34, 0.3, 0x7ec8e8, 1.85, 0.28, 1.65, 12));
  g.add(tbox(1.2, 0.12, 0.7, texMat(planks(PALETTE.wood)), 0, 0.12, 2.45));
  bush(g, -2.05, 2.2, 0.9);
  bush(g, 2.0, 2.1, 0.75);
  lantern(g, -1.3, 2.15, 2.15);
  return g;
}

function stoneLibrary(): THREE.Group {
  const g = new THREE.Group();
  const stone = texMat(stoneBlocks(PALETTE.stone));
  g.add(tbox(3.8, 0.22, 3.8, texMat(stoneBlocks(PALETTE.stoneDeep)), 0, 0.12, 0));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.92, 2.05, 2.2, 12), stone);
  base.position.y = 1.2;
  base.castShadow = true;
  g.add(base, outlineClone(base, 0.015));
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.82, 2.0, 12), stone);
  mid.position.y = 3.2;
  g.add(mid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.62, 1.6, 12), stone);
  top.position.y = 4.95;
  g.add(top);
  for (const y of [2.25, 4.15]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.08, 8, 16), toon(0x9a9588));
    band.position.y = y;
    g.add(band);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.55, 12), texMat(shingles(0x5a6b4a)));
  roof.position.y = 6.5;
  roof.castShadow = true;
  g.add(roof);
  g.add(cyl(0.1, 0.1, 0.75, PALETTE.woodDeep, 0, 7.4, 0, 6));
  g.add(box(0.5, 0.32, 0.05, 0x6fbf8a, 0.26, 7.58, 0));

  const archSh = new THREE.Shape();
  archSh.absarc(0, 0, 0.62, 0, Math.PI, false);
  archSh.lineTo(-0.62, -1.15);
  archSh.lineTo(0.62, -1.15);
  const archGeo = new THREE.ExtrudeGeometry(archSh, { depth: 0.22, bevelEnabled: false });
  archGeo.center();
  const arch = new THREE.Mesh(archGeo, toon(PALETTE.woodDeep));
  arch.position.set(0, 1.35, 1.95);
  g.add(arch);
  g.add(box(0.9, 1.35, 0.1, PALETTE.woodDeep, 0, 0.78, 1.92));

  prettyWindow(g, 1.05, 3.35, 1.48, 0.52, 0.7, -0.45, false, 0x5a6b4a);
  prettyWindow(g, -1.05, 3.35, 1.48, 0.52, 0.7, 0.45, false, 0x5a6b4a);
  prettyWindow(g, 0.95, 5.05, 1.32, 0.46, 0.5, -0.45, false, 0x5a6b4a);
  prettyWindow(g, -0.95, 5.05, 1.32, 0.46, 0.5, 0.45, false, 0x5a6b4a);

  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), toon(PALETTE.grassDeep));
  moss.position.set(1.35, 1.2, 0.95);
  moss.scale.set(1.55, 0.42, 1.15);
  g.add(moss);
  g.add(box(0.52, 0.78, 0.2, 0x6fbf8a, -1.6, 0.45, 1.45));
  g.add(box(0.44, 0.58, 0.18, 0xe23a3a, -1.85, 0.36, 1.28));
  g.add(box(0.4, 0.5, 0.16, 0xf2c14e, -1.55, 0.32, 1.62));
  lantern(g, 1.55, 2.35, 1.7);
  bush(g, -1.95, 1.75, 0.8);
  return g;
}

function stiltShop(): THREE.Group {
  const g = new THREE.Group();
  const plank = texMat(planks(0x3ecfcf));
  for (const x of [-1.55, 1.55]) {
    for (const z of [-1.25, 1.25]) {
      g.add(cyl(0.09, 0.12, 1.85, PALETTE.woodDeep, x, 0.9, z, 6));
    }
  }
  g.add(box(0.08, 1.1, 0.08, PALETTE.woodDeep, -1.55, 1.1, 0));
  g.add(box(0.08, 1.1, 0.08, PALETTE.woodDeep, 1.55, 1.1, 0));
  g.add(tbox(4.05, 0.18, 3.4, texMat(planks(PALETTE.wood)), 0, 1.78, 0));
  const wall = tbox(3.65, 2.15, 3.05, plank, 0, 2.88, 0);
  g.add(wall);
  g.add(box(3.75, 0.12, 3.15, 0x2ab8b8, 0, 3.92, 0));

  const awning = tbox(4.15, 0.1, 1.65, texMat(shingles(0xe23a3a)), 0, 3.78, 1.62);
  awning.rotation.x = -0.3;
  g.add(awning);
  const stripe = box(4.15, 0.06, 1.65, 0xf2c14e, 0, 3.7, 1.62);
  stripe.rotation.x = -0.3;
  g.add(stripe);
  for (let i = 0; i < 7; i++) {
    const scallop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toon(i % 2 ? 0xe23a3a : 0xf2c14e));
    scallop.scale.set(1, 0.42, 1);
    scallop.position.set(-1.65 + i * 0.55, 3.28, 2.2);
    g.add(scallop);
  }

  prettyWindow(g, -1.12, 2.95, 1.56, 0.64, 0.74, 0, false, 0xf2c14e);
  prettyWindow(g, 1.12, 2.95, 1.56, 0.64, 0.74, 0, false, 0xf2c14e);
  g.add(box(0.82, 1.42, 0.1, 0xf2c14e, 0, 2.52, 1.56));
  const sign = box(1.35, 0.5, 0.08, 0xfff6ea, 0, 4.15, 1.78);
  g.add(sign);
  g.add(cyl(0.04, 0.04, 0.35, PALETTE.woodDeep, -0.5, 4.0, 1.78, 5));
  g.add(cyl(0.04, 0.04, 0.35, PALETTE.woodDeep, 0.5, 4.0, 1.78, 5));

  g.add(cyl(0.05, 0.05, 2.05, PALETTE.woodDeep, -1.85, 1.05, 1.5, 6));
  for (let i = 0; i < 6; i++) g.add(box(0.32, 0.07, 0.14, PALETTE.wood, -1.85, 0.28 + i * 0.28, 1.62));

  g.add(box(0.55, 0.4, 0.4, PALETTE.wood, 1.7, 1.98, 1.5));
  g.add(box(0.4, 0.32, 0.35, 0xe23a3a, 1.95, 1.94, 1.25));
  lantern(g, 1.65, 2.7, 1.65);
  for (const x of [-1.4, 1.4]) g.add(box(0.06, 0.45, 2.4, PALETTE.wood, x, 2.05, 0));
  return g;
}

function boatHouse(): THREE.Group {
  const g = new THREE.Group();
  const plank = texMat(planks(PALETTE.wood));
  g.add(tbox(4.7, 0.32, 3.7, texMat(planks(PALETTE.woodDeep)), 0, 0.22, 0));
  const base = tbox(4.35, 2.15, 3.4, plank, 0, 1.4, 0);
  g.add(base, outlineClone(base, 0.015));
  const roofG = pitchedRoof(4.9, 3.7, 1.55, 0x1f3a5a, 0.32);
  roofG.position.y = 2.5;
  g.add(roofG);
  const gable = gableWall(4.35, 1.28, plank);
  gable.position.set(0, 2.5, 1.7);
  g.add(gable);
  prettyWindow(g, -1.32, 1.58, 1.76, 0.72, 0.8, 0, false, 0x1f3a5a);
  prettyWindow(g, 1.32, 1.58, 1.76, 0.72, 0.8, 0, false, 0x1f3a5a);
  g.add(box(1.2, 1.58, 0.12, PALETTE.woodDeep, 0, 1.0, 1.76));
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.2, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xdde8f0, wireframe: true, transparent: true, opacity: 0.75 }),
  );
  net.position.set(1.85, 1.3, 1.86);
  g.add(net);
  lantern(g, -1.65, 2.55, 1.8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 18), toon(0xe23a3a));
  ring.position.set(-1.95, 1.4, 1.86);
  g.add(ring);
  for (const x of [-2.15, 2.15]) g.add(cyl(0.1, 0.12, 1.55, PALETTE.woodDeep, x, 0.55, 2.35, 6));
  g.add(tbox(3.4, 0.12, 1.25, texMat(planks(PALETTE.wood)), 0, 0.2, 2.5));
  g.add(cyl(0.28, 0.28, 0.4, PALETTE.woodDeep, 1.9, 0.42, 1.2, 10));
  g.add(cyl(0.22, 0.22, 0.32, 0x8a5a32, 1.65, 0.38, 0.9, 10));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 16), toon(PALETTE.wood));
  wheel.position.set(-1.9, 1.55, 1.86);
  g.add(wheel);
  return g;
}
