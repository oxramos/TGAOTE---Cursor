import * as THREE from "three";
import { PALETTE, toon } from "../materials";

export type HouseKind = "home" | "mallow" | "pebble" | "coral" | "brine";

export function createHouse(kind: HouseKind): THREE.Group {
  const g = new THREE.Group();
  g.name = `house-${kind}`;
  if (kind === "home") g.add(homeCottage());
  if (kind === "mallow") g.add(woolCottage());
  if (kind === "pebble") g.add(stoneLibrary());
  if (kind === "coral") g.add(stiltShop());
  if (kind === "brine") g.add(boatHouse());
  const lamp = new THREE.PointLight(0xffc07a, 0, 9);
  lamp.name = "porch-lamp";
  lamp.position.set(0, 2.15, 2.35);
  g.add(lamp);
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

export function clapboard(hex: number): THREE.CanvasTexture {
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

export function shingles(hex: number): THREE.CanvasTexture {
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

export function stoneBlocks(hex: number): THREE.CanvasTexture {
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

export function planks(hex: number): THREE.CanvasTexture {
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

function thatch(hex: number): THREE.CanvasTexture {
  return canvasTex(`thatch-${hex}`, (ctx, s) => {
    const [r, g, b] = hexRgb(hex);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 6) {
      for (let x = -8; x < s; x += 10) {
        const t = 0.78 + ((x + y) % 5) * 0.05;
        ctx.strokeStyle = `rgba(${Math.round(r * t)},${Math.round(g * t)},${Math.round(b * t)},0.9)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12, y + 6);
        ctx.stroke();
      }
    }
  });
}

function canvasSign(text: string, bg = "#fff6ea", fg = "#5a2018"): THREE.CanvasTexture {
  return canvasTex(
    `sign-${text}-${bg}`,
    (ctx, s) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = fg;
      ctx.font = "bold 42px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, s / 2, s / 2);
    },
    256,
  );
}

export function texMat(map: THREE.CanvasTexture, tint = 0xffffff, opts?: { emissive?: number }): THREE.MeshToonMaterial {
  return toon(tint, { map, emissive: opts?.emissive });
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
    const panel = tbox(slopeLen, 0.28, depth + overhang * 2, mat, side * cx, cy, 0);
    panel.rotation.z = side === -1 ? angle : -angle;
    g.add(panel);
    const soffit = tbox(slopeLen * 0.98, 0.05, depth + overhang * 1.6, under, side * cx, cy - 0.14, 0);
    soffit.rotation.z = panel.rotation.z;
    g.add(soffit);
  }

  g.add(box(0.2, 0.18, depth + overhang * 2 + 0.12, 0x7a151c, 0, rise + 0.08, 0));

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

  root.add(box(w + 0.1, h + 0.1, 0.22, 0x2a1014, 0, 0, -0.08));
  root.add(box(w + 0.3, h + 0.3, 0.07, 0xfff6ea, 0, 0, 0.04));
  root.add(box(w + 0.14, h + 0.14, 0.06, 0x7a1c22, 0, 0, 0.08));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), toon(0xf4b3c8, { emissive: 0xe89ab0 }));
  glass.position.z = 0.12;
  root.add(glass);
  root.add(box(0.05, h - 0.1, 0.06, 0xfff6ea, 0, 0, 0.13));
  root.add(box(w - 0.1, 0.05, 0.06, 0xfff6ea, 0, 0, 0.13));
  root.add(box(w + 0.38, 0.12, 0.26, 0xfff1dc, 0, -h / 2 - 0.1, 0.08));

  if (shutter) {
    for (const side of [-1, 1] as const) {
      root.add(box(0.2, h + 0.1, 0.06, shutter, side * (w / 2 + 0.24), 0, 0.06));
      root.add(box(0.16, 0.04, 0.05, 0x7a1c22, side * (w / 2 + 0.24), 0, 0.1));
    }
  }

  if (withBox) {
    root.add(box(w + 0.4, 0.16, 0.3, PALETTE.wood, 0, -h / 2 - 0.24, 0.2));
    const blooms = [0xe56b9e, 0xf2c14e, 0xff8ba7, 0x7bc47a, 0xfff6ea];
    blooms.forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon(col));
      f.position.set(-w * 0.36 + i * 0.18, -h / 2 - 0.08, 0.28);
      root.add(f);
    });
  }
  parent.add(root);
}

function roundWindow(parent: THREE.Group, x: number, y: number, z: number, r = 0.32, rotY = 0) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;
  root.add(cyl(r + 0.08, r + 0.08, 0.08, 0xfff6ea, 0, 0, 0.04, 16));
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r, 16), toon(0xf4b3c8, { emissive: 0xe89ab0 }));
  glass.position.z = 0.09;
  root.add(glass);
  parent.add(root);
}

function steps(parent: THREE.Group, x: number, z: number, yaw = 0, count = 4) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.add(box(1.55, 0.22, 0.12, PALETTE.woodDeep, -0.72, 0.45, -0.15));
  g.add(box(1.55, 0.22, 0.12, PALETTE.woodDeep, 0.72, 0.45, -0.15));
  for (let i = 0; i < count; i++) {
    const w = 1.5 - i * 0.02;
    g.add(box(w, 0.13, 0.36, PALETTE.stone, 0, 0.08 + i * 0.13, 0.18 - i * 0.3));
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

function smokePuffs(parent: THREE.Group, x: number, y: number, z: number) {
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 + i * 0.04, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0.32 - i * 0.06, depthWrite: false }),
    );
    puff.name = "chimney-puff";
    puff.userData = { phase: i * 1.1, baseY: y + i * 0.24 };
    puff.position.set(x + i * 0.05, y + i * 0.24, z);
    parent.add(puff);
  }
}

function picketFence(parent: THREE.Group, x: number, z: number, count: number, alongX: boolean) {
  for (let i = 0; i < count; i++) {
    const px = alongX ? x + i * 0.28 : x;
    const pz = alongX ? z : z + i * 0.28;
    parent.add(box(0.07, 0.78, 0.07, 0xfff6ea, px, 0.42, pz));
    parent.add(box(0.12, 0.08, 0.12, 0xfff6ea, px, 0.84, pz));
    if (i < count - 1) {
      parent.add(box(alongX ? 0.28 : 0.05, 0.05, alongX ? 0.05 : 0.28, PALETTE.roof, px + (alongX ? 0.14 : 0), 0.62, pz + (alongX ? 0 : 0.14)));
    }
  }
}

function homeCottage(): THREE.Group {
  const g = new THREE.Group();
  const cream = PALETTE.cottage;
  const roof = PALETTE.roof;
  const siding = texMat(clapboard(cream));
  const stone = texMat(stoneBlocks(PALETTE.stone));
  const trim = 0xfff1dc;

  g.add(tbox(6.05, 0.72, 5.15, stone, 0.2, 0.32, -0.08));
  for (const x of [-2.8, 2.85]) {
    for (const z of [-2.4, 2.28]) g.add(tbox(0.38, 0.88, 0.38, stone, x, 0.4, z));
  }

  const lower = tbox(5.35, 2.62, 4.35, siding, 0, 1.58, 0);
  g.add(lower);
  g.add(box(5.5, 0.14, 4.48, roof, 0, 2.9, 0));
  g.add(box(5.38, 0.05, 4.38, trim, 0, 2.8, 0));

  const upper = tbox(4.55, 1.92, 3.72, siding, 0, 3.82, -0.08);
  g.add(upper);

  for (const x of [-2.62, 2.62]) {
    g.add(box(0.12, 2.62, 0.12, trim, x, 1.58, 2.12));
    g.add(box(0.12, 2.62, 0.12, trim, x, 1.58, -2.12));
  }
  for (const x of [-2.22, 2.22]) {
    g.add(box(0.1, 1.9, 0.1, trim, x, 3.82, 1.74));
    g.add(box(0.1, 1.9, 0.1, trim, x, 3.82, -1.9));
  }

  const wing = tbox(2.45, 2.15, 3.15, siding, 3.55, 1.4, -0.35);
  g.add(wing);
  g.add(tbox(2.65, 0.4, 3.3, stone, 3.55, 0.22, -0.35));
  const wingRoof = pitchedRoof(3.4, 2.7, 1.15, roof, 0.22);
  wingRoof.rotation.y = Math.PI / 2;
  wingRoof.position.set(3.55, 2.5, -0.35);
  g.add(wingRoof);
  prettyWindow(g, 3.55, 1.55, 1.28, 0.7, 0.86, 0, true);

  const roofY = 4.72;
  const roofG = pitchedRoof(5.7, 4.35, 2.15, roof, 0.46);
  roofG.position.y = roofY;
  g.add(roofG);
  const gableF = gableWall(4.55, 1.72, siding);
  gableF.position.set(0, roofY, 1.74);
  const gableB = gableWall(4.55, 1.72, siding);
  gableB.position.set(0, roofY, -1.9);
  g.add(gableF, gableB);

  for (const sx of [-0.92, 0.92]) {
    const d = new THREE.Group();
    d.add(tbox(0.95, 0.72, 0.8, siding, 0, 0.22, 0.05));
    const dr = pitchedRoof(1.15, 0.95, 0.52, roof, 0.08);
    dr.position.y = 0.58;
    d.add(dr);
    prettyWindow(d, 0, 0.18, 0.48, 0.4, 0.44, 0, false);
    d.position.set(sx, 5.22, 1.05);
    g.add(d);
  }

  const brick = texMat(stoneBlocks(0xb85a4a));
  g.add(tbox(0.58, 1.7, 0.58, brick, 1.72, 5.95, -0.62));
  g.add(box(0.74, 0.12, 0.74, PALETTE.stoneDeep, 1.72, 6.82, -0.62));
  g.add(box(0.22, 0.3, 0.22, 0x6a4038, 1.72, 7.02, -0.62));
  smokePuffs(g, 1.72, 7.12, -0.62);

  g.add(box(0.04, 0.5, 0.04, 0xf2c14e, 0, 6.95, 0));
  const hg = new THREE.ExtrudeGeometry(heartShape(0.15), { depth: 0.04, bevelEnabled: false });
  hg.center();
  const vaneH = new THREE.Mesh(hg, toon(0xe23a3a));
  vaneH.position.set(0.18, 7.12, 0);
  g.add(vaneH);

  prettyWindow(g, -1.52, 1.62, 2.22);
  prettyWindow(g, 1.52, 1.62, 2.22);
  prettyWindow(g, -0.8, 3.82, 1.82, 0.7, 0.82, 0, false);
  prettyWindow(g, 0.8, 3.82, 1.82, 0.7, 0.82, 0, false);
  prettyWindow(g, -2.72, 1.62, 0.2, 0.7, 0.9, Math.PI / 2, true);
  prettyWindow(g, 2.72, 1.62, 0.55, 0.62, 0.82, -Math.PI / 2, false);

  g.add(tbox(3.15, 0.14, 1.85, texMat(planks(PALETTE.wood)), 0, 0.62, 2.95));
  for (const x of [-1.28, 1.28]) {
    g.add(cyl(0.09, 0.1, 1.85, trim, x, 1.5, 3.62, 8));
    g.add(cyl(0.14, 0.15, 0.12, PALETTE.wood, x, 0.64, 3.62, 8));
    g.add(box(0.16, 0.08, 0.16, trim, x, 2.42, 3.62));
  }
  g.add(box(2.7, 0.08, 0.08, PALETTE.roof, 0, 2.08, 3.28));
  for (let i = 0; i < 9; i++) g.add(cyl(0.018, 0.018, 0.62, trim, -1.12 + i * 0.28, 1.72, 3.28, 5));
  const porchRoof = pitchedRoof(3.35, 2.05, 1.05, roof, 0.16);
  porchRoof.position.set(0, 2.48, 3.05);
  g.add(porchRoof);
  const porchGable = gableWall(2.85, 0.82, siding);
  porchGable.position.set(0, 2.48, 3.92);
  g.add(porchGable);
  lantern(g, -1.15, 2.05, 3.5);
  lantern(g, 1.15, 2.05, 3.5);

  steps(g, 0, 3.78, 0, 5);

  g.add(box(1.22, 1.95, 0.18, 0x2a1014, 0, 1.42, 2.12));
  g.add(box(1.12, 1.82, 0.1, roof, 0, 1.42, 2.22));
  g.add(box(0.42, 0.55, 0.04, 0x7a1c22, -0.22, 1.12, 2.28));
  g.add(box(0.42, 0.55, 0.04, 0x7a1c22, 0.22, 1.12, 2.28));
  g.add(box(0.42, 0.48, 0.04, 0x7a1c22, -0.22, 1.78, 2.28));
  g.add(box(0.42, 0.48, 0.04, 0x7a1c22, 0.22, 1.78, 2.28));
  const doorHeart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.16), { depth: 0.05, bevelEnabled: false }).center(),
    toon(0xf4b3c8, { emissive: 0xe89ab0 }),
  );
  doorHeart.position.set(0, 1.92, 2.3);
  g.add(doorHeart);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), toon(0xf2c14e));
  knob.position.set(0.38, 1.32, 2.3);
  g.add(knob);

  g.add(tbox(2.35, 0.08, 0.72, texMat(planks(PALETTE.wood)), 0, 2.95, 2.28));
  for (const x of [-1.0, 1.0]) g.add(cyl(0.035, 0.035, 0.58, trim, x, 3.24, 2.52, 6));
  g.add(box(2.2, 0.07, 0.07, PALETTE.roof, 0, 3.52, 2.52));
  for (let i = 0; i < 8; i++) g.add(cyl(0.016, 0.016, 0.52, trim, -0.92 + i * 0.26, 3.22, 2.52, 5));

  g.add(box(0.3, 0.24, 0.2, PALETTE.roof, 2.05, 0.92, 3.05));
  g.add(cyl(0.03, 0.03, 0.78, PALETTE.woodDeep, 2.05, 0.42, 3.05, 6));
  g.add(box(0.08, 0.12, 0.04, 0xf2c14e, 2.05, 1.08, 3.16));

  picketFence(g, -3.35, 2.55, 8, true);
  picketFence(g, -3.35, 2.55, 6, false);

  const well = cyl(0.42, 0.48, 0.55, PALETTE.stone, -3.05, 0.32, 1.35, 12);
  g.add(well);
  g.add(box(0.06, 0.7, 0.06, PALETTE.woodDeep, -3.35, 0.85, 1.35));
  g.add(box(0.06, 0.7, 0.06, PALETTE.woodDeep, -2.75, 0.85, 1.35));
  g.add(box(0.7, 0.06, 0.08, PALETTE.wood, -3.05, 1.18, 1.35));
  const bucket = cyl(0.12, 0.1, 0.16, PALETTE.woodDeep, -3.05, 0.95, 1.35, 8);
  g.add(bucket);

  bush(g, -2.7, 2.85, 1.15);
  bush(g, 2.75, 2.65, 1.0);
  bush(g, -2.95, -1.85, 0.95);
  bush(g, 4.55, 1.15, 0.8);

  for (let i = 0; i < 7; i++) {
    const stoneStep = box(0.46 + (i % 2) * 0.12, 0.08, 0.32, PALETTE.stone, (i - 3) * 0.08, 0.06, 4.15 + i * 0.32);
    stoneStep.rotation.y = (i - 3) * 0.08;
    g.add(stoneStep);
  }

  const vine = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), toon(PALETTE.grass));
  vine.scale.set(0.5, 2.35, 0.38);
  vine.position.set(-2.58, 2.65, 2.05);
  g.add(vine);

  return g;
}

function woolCottage(): THREE.Group {
  const g = new THREE.Group();
  const wool = 0xfff0e8;
  g.add(cyl(2.15, 2.28, 0.45, PALETTE.stone, 0, 0.2, 0, 16));
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.05, 24, 18), toon(wool));
  body.position.y = 1.95;
  body.scale.set(1.18, 1.02, 1.1);
  body.castShadow = true;
  g.add(body);
  for (let ring = 0; ring < 3; ring++) {
    const n = 12 - ring * 2;
    const y = 0.85 + ring * 0.85;
    const rad = 2.05 - ring * 0.12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), toon(i % 2 ? 0xfff6ea : wool));
      puff.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.92);
      puff.castShadow = true;
      g.add(puff);
    }
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.65, 16), texMat(shingles(0xf4c6d7)));
  cap.position.y = 3.85;
  cap.castShadow = true;
  g.add(cap);
  for (let ring = 0; ring < 5; ring++) {
    const y = 3.15 + ring * 0.28;
    const n = 12 - ring * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1.55 - ring * 0.26;
      const tile = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), toon(i % 2 ? 0xf4c6d7 : 0xe56b9e));
      tile.scale.set(1, 0.4, 1);
      tile.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(tile);
    }
  }
  g.add(cyl(0.18, 0.2, 0.7, 0xe56b9e, 0.65, 4.85, -0.2, 8));
  smokePuffs(g, 0.65, 5.2, -0.2);
  roundWindow(g, -0.85, 2.05, 2.12, 0.34);
  roundWindow(g, 0.85, 2.05, 2.12, 0.34);
  g.add(box(0.95, 1.55, 0.16, 0xe56b9e, 0, 0.95, 2.28));
  g.add(box(0.85, 0.04, 0.05, 0xfff6ea, 0, 0.95, 2.38));
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), toon(0x7bc47a));
  wreath.position.set(0, 1.45, 2.4);
  g.add(wreath);
  g.add(tbox(1.35, 0.12, 0.8, texMat(planks(PALETTE.wood)), 0, 0.14, 2.55));
  g.add(cyl(0.38, 0.4, 0.32, 0x7ec8e8, 1.95, 0.28, 1.7, 12));
  g.add(cyl(0.22, 0.24, 0.28, PALETTE.grass, 1.95, 0.55, 1.7, 10));
  bush(g, -2.15, 2.25, 0.95);
  bush(g, 2.05, 2.15, 0.8);
  lantern(g, -1.35, 2.25, 2.22);
  return g;
}

function stoneLibrary(): THREE.Group {
  const g = new THREE.Group();
  const stone = texMat(stoneBlocks(PALETTE.stone));
  const deep = texMat(stoneBlocks(PALETTE.stoneDeep));
  g.add(tbox(4.4, 0.28, 4.4, deep, 0, 0.12, 0));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.2, 2.35, 8), stone);
  base.position.y = 1.28;
  base.castShadow = true;
  g.add(base);
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.95, 2.05, 8), stone);
  mid.position.y = 3.4;
  g.add(mid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.7, 1.55, 8), stone);
  top.position.y = 5.15;
  g.add(top);
  for (const y of [2.42, 4.38]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.09, 8, 8), toon(0x9a9588));
    band.position.y = y;
    g.add(band);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const btr = tbox(0.42, 2.6, 0.55, deep, Math.cos(a) * 2.15, 1.2, Math.sin(a) * 2.15);
    btr.rotation.y = -a;
    btr.rotation.z = 0.18;
    g.add(btr);
  }
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.12, 8), texMat(shingles(0x5a6b4a)));
  eave.position.y = 5.95;
  g.add(eave);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.7, 8), texMat(shingles(0x5a6b4a)));
  roof.position.y = 6.8;
  roof.castShadow = true;
  g.add(roof);
  g.add(cyl(0.08, 0.08, 0.85, PALETTE.woodDeep, 0, 7.75, 0, 6));
  g.add(box(0.55, 0.35, 0.05, 0x6fbf8a, 0.28, 7.95, 0));

  g.add(box(1.15, 1.55, 0.2, 0x1a1410, 0, 0.95, 2.12));
  const archSh = new THREE.Shape();
  archSh.absarc(0, 0, 0.58, 0, Math.PI, false);
  archSh.lineTo(-0.58, -1.2);
  archSh.lineTo(0.58, -1.2);
  const archGeo = new THREE.ExtrudeGeometry(archSh, { depth: 0.28, bevelEnabled: false });
  archGeo.center();
  const arch = new THREE.Mesh(archGeo, deep);
  arch.position.set(0, 1.42, 2.18);
  g.add(arch);
  g.add(box(0.95, 1.42, 0.08, PALETTE.woodDeep, 0, 0.85, 2.22));

  prettyWindow(g, 1.12, 3.5, 1.55, 0.5, 0.68, -0.4, false, 0x5a6b4a);
  prettyWindow(g, -1.12, 3.5, 1.55, 0.5, 0.68, 0.4, false, 0x5a6b4a);
  prettyWindow(g, 0.98, 5.2, 1.38, 0.42, 0.48, -0.4, false, 0x5a6b4a);
  prettyWindow(g, -0.98, 5.2, 1.38, 0.42, 0.48, 0.4, false, 0x5a6b4a);

  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), toon(PALETTE.grassDeep));
  moss.position.set(1.45, 1.15, 1.05);
  moss.scale.set(1.6, 0.45, 1.2);
  g.add(moss);
  g.add(box(0.52, 0.82, 0.2, 0x6fbf8a, -1.75, 0.48, 1.55));
  g.add(box(0.44, 0.62, 0.18, 0xe23a3a, -2.0, 0.38, 1.35));
  g.add(box(0.4, 0.52, 0.16, 0xf2c14e, -1.65, 0.34, 1.72));
  lantern(g, 1.65, 2.45, 1.85);
  bush(g, -2.15, 1.85, 0.85);
  steps(g, 0, 2.55, 0, 3);
  return g;
}

function stiltShop(): THREE.Group {
  const g = new THREE.Group();
  const plank = texMat(planks(0x3ecfcf));
  const wood = texMat(planks(PALETTE.wood));
  for (const x of [-1.65, 1.65]) {
    for (const z of [-1.35, 1.35]) {
      g.add(cyl(0.1, 0.13, 2.05, PALETTE.woodDeep, x, 1.0, z, 6));
    }
  }
  g.add(box(3.2, 0.08, 0.08, PALETTE.woodDeep, 0, 0.7, 1.35));
  g.add(box(3.2, 0.08, 0.08, PALETTE.woodDeep, 0, 1.15, -1.35));
  g.add(tbox(4.25, 0.16, 3.55, wood, 0, 2.02, 0));
  for (const x of [-1.95, 1.95]) g.add(box(0.08, 0.45, 3.2, PALETTE.wood, x, 2.28, 0));

  g.add(tbox(3.85, 2.25, 0.18, plank, 0, 3.18, -1.55));
  g.add(tbox(0.18, 2.25, 3.15, plank, -1.9, 3.18, 0));
  g.add(tbox(0.18, 2.25, 3.15, plank, 1.9, 3.18, 0));

  const thatchMat = texMat(thatch(0xd4a44a));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.15, 1.85, 8), thatchMat);
  roof.position.y = 5.15;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(3.95, 0.1, 3.25, 0xc48a4a, 0, 4.28, 0));

  const awning = tbox(4.25, 0.1, 1.7, texMat(shingles(0xe23a3a)), 0, 4.05, 1.72);
  awning.rotation.x = -0.28;
  g.add(awning);
  for (let i = 0; i < 8; i++) {
    const scallop = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), toon(i % 2 ? 0xe23a3a : 0xf2c14e));
    scallop.scale.set(1, 0.4, 1);
    scallop.position.set(-1.75 + i * 0.5, 3.48, 2.35);
    g.add(scallop);
  }

  prettyWindow(g, -1.2, 3.2, 1.62, 0.62, 0.72, 0, false, 0xf2c14e);
  prettyWindow(g, 1.2, 3.2, 1.62, 0.62, 0.72, 0, false, 0xf2c14e);
  g.add(tbox(2.15, 0.85, 0.7, wood, 0, 2.55, 1.85));
  g.add(box(0.08, 0.55, 0.55, PALETTE.woodDeep, -1.0, 2.85, 1.85));
  g.add(box(0.08, 0.55, 0.55, PALETTE.woodDeep, 1.0, 2.85, 1.85));

  const sign = tbox(1.55, 0.55, 0.08, texMat(canvasSign("CORAL", "#fff6ea", "#c41f28")), 0, 4.45, 1.95);
  g.add(sign);
  g.add(cyl(0.04, 0.04, 0.4, PALETTE.woodDeep, -0.55, 4.22, 1.95, 5));
  g.add(cyl(0.04, 0.04, 0.4, PALETTE.woodDeep, 0.55, 4.22, 1.95, 5));

  g.add(cyl(0.05, 0.05, 2.2, PALETTE.woodDeep, -2.05, 1.12, 1.62, 6));
  for (let i = 0; i < 7; i++) g.add(box(0.34, 0.07, 0.14, PALETTE.wood, -2.05, 0.28 + i * 0.28, 1.75));

  g.add(box(0.58, 0.42, 0.42, PALETTE.wood, 1.85, 2.22, 1.55));
  g.add(box(0.42, 0.34, 0.36, 0xe23a3a, 2.12, 2.18, 1.28));
  g.add(box(0.32, 0.28, 0.3, 0xf2c14e, 1.65, 2.16, 1.72));
  lantern(g, 1.75, 2.95, 1.72);
  for (const col of [0x7ec8e8, 0xffb3c7, 0xf2c14e]) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toon(col));
    shell.position.set(-0.45 + (col & 7) * 0.12, 3.55, 1.95);
    g.add(shell);
  }
  return g;
}

function boatHouse(): THREE.Group {
  const g = new THREE.Group();
  const plank = texMat(planks(PALETTE.wood));
  const deep = texMat(planks(PALETTE.woodDeep));
  g.add(tbox(5.05, 0.38, 3.9, deep, 0, 0.22, 0));
  g.add(tbox(4.55, 2.25, 0.22, plank, 0, 1.5, -1.62));
  g.add(tbox(0.22, 2.25, 3.45, plank, -2.22, 1.5, 0));
  g.add(tbox(0.22, 2.25, 3.45, plank, 2.22, 1.5, 0));
  g.add(tbox(1.35, 2.25, 0.18, plank, -1.55, 1.5, 1.72));
  g.add(tbox(1.35, 2.25, 0.18, plank, 1.55, 1.5, 1.72));

  g.add(box(1.85, 2.05, 0.08, 0x1a1410, 0, 1.2, 1.55));
  const doorL = tbox(0.95, 1.95, 0.1, deep, -0.72, 1.15, 1.78);
  doorL.rotation.y = 0.55;
  g.add(doorL);
  const doorR = tbox(0.95, 1.95, 0.1, deep, 0.85, 1.15, 1.72);
  doorR.rotation.y = -0.12;
  g.add(doorR);

  const roofG = pitchedRoof(5.2, 4.0, 1.65, 0x1f3a5a, 0.36);
  roofG.position.y = 2.65;
  g.add(roofG);
  const gable = gableWall(4.55, 1.35, plank);
  gable.position.set(0, 2.65, 1.78);
  g.add(gable);
  prettyWindow(g, -1.45, 1.65, 1.82, 0.62, 0.7, 0, false, 0x1f3a5a);
  prettyWindow(g, 1.45, 1.65, 1.82, 0.62, 0.7, 0, false, 0x1f3a5a);
  prettyWindow(g, 0, 3.35, 1.78, 0.55, 0.48, 0, false, 0x1f3a5a);

  g.add(box(0.12, 0.12, 2.4, PALETTE.woodDeep, 0, 3.55, 2.4));
  g.add(cyl(0.05, 0.05, 0.45, PALETTE.woodDeep, 0, 3.28, 3.45, 6));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 10), toon(0xc0c4c8));
  hook.position.set(0, 3.02, 3.45);
  g.add(hook);

  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.2, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xdde8f0, wireframe: true, transparent: true, opacity: 0.75 }),
  );
  net.position.set(2.05, 1.35, 1.95);
  g.add(net);
  lantern(g, -1.85, 2.65, 1.92);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 8, 18), toon(0xe23a3a));
  ring.position.set(-2.15, 1.45, 1.95);
  g.add(ring);
  for (const x of [-2.35, 2.35]) g.add(cyl(0.1, 0.12, 1.65, PALETTE.woodDeep, x, 0.55, 2.45, 6));
  g.add(tbox(3.6, 0.12, 1.35, texMat(planks(PALETTE.wood)), 0, 0.2, 2.62));
  g.add(cyl(0.3, 0.3, 0.42, PALETTE.woodDeep, 2.05, 0.44, 1.15, 10));
  g.add(cyl(0.24, 0.24, 0.34, 0x8a5a32, 1.78, 0.4, 0.85, 10));
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.08, 8, 14), toon(PALETTE.wood));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(-1.85, 0.32, 1.15);
  g.add(coil);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16), toon(PALETTE.wood));
  wheel.position.set(-2.05, 1.65, 1.95);
  g.add(wheel);
  return g;
}
