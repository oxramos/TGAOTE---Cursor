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

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
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

function pitchedRoof(width: number, depth: number, rise: number, color: number, overhang = 0.32): THREE.Group {
  const g = new THREE.Group();
  const extra = overhang;
  const hypot = Math.hypot(width / 2, rise);
  const slopeLen = hypot + extra;
  const angle = Math.atan2(rise, width / 2);
  const cx = width / 4 + Math.cos(angle) * extra * 0.5;
  const cy = rise / 2 - Math.sin(angle) * extra * 0.5;
  const roofDark = new THREE.Color(color).offsetHSL(0, 0, -0.08).getHex();

  for (const side of [-1, 1] as const) {
    const panel = box(slopeLen, 0.12, depth + overhang * 2, color, side * cx, cy, 0);
    panel.rotation.z = side === -1 ? angle : -angle;
    g.add(panel);
    const tile = box(slopeLen * 0.92, 0.04, 0.08, roofDark, side * cx, cy + 0.06, 0);
    tile.rotation.z = panel.rotation.z;
    g.add(tile);
  }

  g.add(box(0.16, 0.14, depth + overhang * 2 + 0.08, 0x8a1c24, 0, rise + 0.04, 0));

  const fascia = 0x7a151c;
  for (const z of [-depth / 2 - overhang * 0.15, depth / 2 + overhang * 0.15]) {
    for (const side of [-1, 1] as const) {
      const board = box(slopeLen + 0.05, 0.08, 0.08, fascia, side * cx, cy, z);
      board.rotation.z = side === -1 ? angle : -angle;
      g.add(board);
    }
  }
  return g;
}

function gableWall(width: number, rise: number, color: number): THREE.Mesh {
  const sh = new THREE.Shape();
  sh.moveTo(-width / 2, 0);
  sh.lineTo(width / 2, 0);
  sh.lineTo(0, rise);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false });
  geo.translate(0, 0, -0.08);
  const m = new THREE.Mesh(geo, toon(color));
  m.castShadow = true;
  return m;
}

function prettyWindow(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w = 0.78,
  h = 0.92,
  rotY = 0,
  withBox = true,
) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;

  root.add(box(w + 0.14, h + 0.14, 0.1, PALETTE.roof, 0, 0, 0));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.04, h - 0.04),
    toon(0xf4b3c8, { emissive: 0xe89ab0 }),
  );
  glass.position.z = 0.06;
  root.add(glass);
  root.add(box(0.045, h - 0.1, 0.06, 0xfff6ea, 0, 0, 0.07));
  root.add(box(w - 0.1, 0.045, 0.06, 0xfff6ea, 0, 0, 0.07));
  root.add(box(w + 0.22, 0.08, 0.18, 0xfff1dc, 0, -h / 2 - 0.05, 0.04));

  if (withBox) {
    const planter = box(w + 0.28, 0.16, 0.22, PALETTE.wood, 0, -h / 2 - 0.16, 0.14);
    root.add(planter);
    const blooms = [0xe56b9e, 0xf2c14e, 0xff8ba7, 0x7bc47a];
    blooms.forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon(col));
      f.position.set(-w * 0.32 + i * 0.22, -h / 2 - 0.02, 0.2);
      root.add(f);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), toon(PALETTE.grassDeep));
      leaf.scale.set(1.2, 0.4, 0.8);
      leaf.position.set(f.position.x + 0.04, -h / 2 - 0.1, 0.16);
      root.add(leaf);
    });
  }
  parent.add(root);
}

function steps(parent: THREE.Group, x: number, z: number, yaw = 0, count = 3) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  for (let i = 0; i < count; i++) {
    const w = 1.35 - i * 0.04;
    g.add(box(w, 0.14, 0.32, PALETTE.stone, 0, 0.08 + i * 0.14, 0.16 - i * 0.28));
  }
  parent.add(g);
}

function bush(parent: THREE.Group, x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const cols = [PALETTE.grass, PALETTE.grassDeep, PALETTE.grassTip];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 10, 8), toon(cols[i % 3]));
    s.position.set((i - 2) * 0.14 * scale, 0.28 * scale + (i % 2) * 0.08, (i % 3) * 0.08);
    s.castShadow = true;
    g.add(s);
  }
  const flower = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), toon(0xff8ba7));
  flower.position.set(0.1, 0.55 * scale, 0.12);
  g.add(flower);
  parent.add(g);
}

function lantern(parent: THREE.Group, x: number, y: number, z: number) {
  parent.add(cyl(0.03, 0.03, 0.18, PALETTE.woodDeep, x, y + 0.12, z, 6));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  lamp.position.set(x, y, z);
  parent.add(lamp);
}

function homeCottage(): THREE.Group {
  const g = new THREE.Group();
  const cream = PALETTE.cottage;
  const creamDeep = 0xe8d36a;
  const roof = PALETTE.roof;

  g.add(box(5.35, 0.5, 4.55, PALETTE.stone, 0, 0.22, -0.08));
  for (const x of [-2.5, 2.5]) {
    for (const z of [-2.1, 2.0]) {
      g.add(box(0.28, 0.62, 0.28, PALETTE.stoneDeep, x, 0.28, z));
    }
  }

  const lower = box(4.9, 2.45, 4.05, cream, 0, 1.45, 0);
  g.add(lower, outlineClone(lower, 0.018));
  g.add(box(5.05, 0.18, 4.2, roof, 0, 2.68, 0));
  g.add(box(4.95, 0.06, 4.12, 0xfff1dc, 0, 2.58, 0));

  const upper = box(4.25, 1.72, 3.55, cream, 0, 3.55, -0.08);
  g.add(upper);
  g.add(box(4.4, 0.1, 3.68, creamDeep, 0, 2.78, -0.08));

  for (const x of [-2.38, 2.38]) {
    g.add(box(0.12, 2.35, 0.12, creamDeep, x, 1.45, 1.95));
    g.add(box(0.12, 2.35, 0.12, creamDeep, x, 1.45, -1.95));
  }

  const roofY = 4.38;
  const roofRise = 1.92;
  const roofW = 5.15;
  const roofD = 4.05;
  const roofG = pitchedRoof(roofW, roofD, roofRise, roof, 0.38);
  roofG.position.y = roofY;
  g.add(roofG);

  const gableF = gableWall(4.25, 1.55, cream);
  gableF.position.set(0, roofY, 1.68);
  const gableB = gableWall(4.25, 1.55, cream);
  gableB.position.set(0, roofY, -1.84);
  g.add(gableF, gableB);

  const chimney = box(0.52, 1.35, 0.52, 0xb85a4a, 1.55, 5.55, -0.55);
  g.add(chimney);
  g.add(box(0.64, 0.1, 0.64, PALETTE.stoneDeep, 1.55, 6.22, -0.55));
  g.add(box(0.22, 0.22, 0.22, 0x6a4038, 1.55, 6.38, -0.55));
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + i * 0.04, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0.35 - i * 0.06, depthWrite: false }),
    );
    puff.name = "chimney-puff";
    puff.userData = { phase: i * 1.1, baseY: 6.55 + i * 0.22 };
    puff.position.set(1.55 + i * 0.04, 6.55 + i * 0.22, -0.55);
    g.add(puff);
  }

  prettyWindow(g, -1.42, 1.55, 2.08, 0.82, 0.95);
  prettyWindow(g, 1.42, 1.55, 2.08, 0.82, 0.95);
  prettyWindow(g, -0.72, 3.55, 1.74, 0.7, 0.82, 0, false);
  prettyWindow(g, 0.72, 3.55, 1.74, 0.7, 0.82, 0, false);
  prettyWindow(g, -2.48, 1.55, 0.2, 0.7, 0.88, Math.PI / 2, true);
  prettyWindow(g, 2.48, 1.55, 0.2, 0.7, 0.88, -Math.PI / 2, true);

  const porchFloor = box(2.35, 0.12, 1.45, PALETTE.wood, 0, 0.52, 2.55);
  g.add(porchFloor);
  for (const x of [-0.95, 0.95]) {
    g.add(cyl(0.07, 0.08, 1.55, 0xfff6ea, x, 1.28, 3.12, 8));
    g.add(cyl(0.1, 0.11, 0.08, PALETTE.wood, x, 0.58, 3.12, 8));
  }
  const porchRoof = pitchedRoof(2.55, 1.55, 0.85, roof, 0.12);
  porchRoof.position.set(0, 2.12, 2.72);
  g.add(porchRoof);
  const porchGable = gableWall(2.2, 0.7, cream);
  porchGable.position.set(0, 2.12, 3.42);
  g.add(porchGable);

  steps(g, 0, 3.35, 0, 4);

  const door = box(0.92, 1.55, 0.1, roof, 0, 1.3, 2.08);
  g.add(door);
  const doorPanel = box(0.72, 0.55, 0.04, 0x9a1c24, 0, 0.95, 2.14);
  g.add(doorPanel);
  const hg = new THREE.ExtrudeGeometry(heartShape(0.16), { depth: 0.04, bevelEnabled: false });
  hg.center();
  const doorHeart = new THREE.Mesh(hg, toon(0xf4b3c8, { emissive: 0xe89ab0 }));
  doorHeart.position.set(0, 1.72, 2.16);
  g.add(doorHeart);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), toon(0xf2c14e));
  knob.position.set(0.32, 1.22, 2.18);
  g.add(knob);

  const balcony = box(2.1, 0.08, 0.7, PALETTE.wood, 0, 2.78, 2.12);
  g.add(balcony);
  for (const x of [-0.9, 0.9]) g.add(cyl(0.035, 0.035, 0.55, 0xfff6ea, x, 3.08, 2.38, 6));
  g.add(box(2.05, 0.06, 0.06, PALETTE.roof, 0, 3.34, 2.38));
  for (let i = 0; i < 7; i++) {
    g.add(cyl(0.018, 0.018, 0.5, 0xfff1dc, -0.84 + i * 0.28, 3.06, 2.38, 5));
  }

  lantern(g, -1.15, 1.85, 3.05);
  bush(g, -2.35, 2.55, 1.05);
  bush(g, 2.4, 2.45, 0.9);
  bush(g, -2.6, -1.6, 0.85);
  bush(g, 2.55, -1.8, 0.7);

  for (let i = 0; i < 5; i++) {
    const stone = box(0.38 + (i % 2) * 0.08, 0.08, 0.28, PALETTE.stone, (i - 2) * 0.12, 0.06, 3.7 + i * 0.32);
    stone.rotation.y = (i - 2) * 0.12;
    g.add(stone);
  }

  const vine = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toon(PALETTE.grass));
  vine.scale.set(0.6, 1.8, 0.4);
  vine.position.set(-2.35, 2.4, 1.9);
  g.add(vine);

  return g;
}

function woolCottage(): THREE.Group {
  const g = new THREE.Group();
  const wool = 0xfff0e8;
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.05, 22, 16), toon(wool));
  body.position.y = 1.75;
  body.scale.set(1.2, 0.95, 1.05);
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.03));
  for (let i = 0; i < 14; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.48 + (i % 3) * 0.08, 10, 8), toon(i % 2 ? 0xfff6ea : wool));
    const a = (i / 14) * Math.PI * 2;
    puff.position.set(Math.cos(a) * 1.85, 1.55 + (i % 4) * 0.28, Math.sin(a) * 1.55);
    puff.castShadow = true;
    g.add(puff);
  }
  const roof = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10), toon(0xf4c6d7));
  roof.position.y = 3.45;
  g.add(roof);
  prettyWindow(g, -0.85, 1.85, 1.95, 0.55, 0.62, 0, false);
  prettyWindow(g, 0.85, 1.85, 1.95, 0.55, 0.62, 0, false);
  const door = box(0.85, 1.35, 0.12, 0xe56b9e, 0, 0.78, 2.15);
  g.add(door);
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 14), toon(0x7bc47a));
  wreath.position.set(0, 1.25, 2.24);
  g.add(wreath);
  g.add(cyl(0.32, 0.32, 0.28, 0x7ec8e8, 1.7, 0.28, 1.55, 10));
  bush(g, -1.9, 2.1, 0.85);
  bush(g, 1.85, 2.0, 0.7);
  return g;
}

function stoneLibrary(): THREE.Group {
  const g = new THREE.Group();
  const tower = cyl(1.55, 1.82, 5.4, PALETTE.stone, 0, 2.7, 0, 12);
  g.add(tower, outlineClone(tower, 0.02));
  g.add(box(3.6, 0.18, 3.6, PALETTE.stoneDeep, 0, 0.12, 0));
  g.add(cyl(1.62, 1.62, 0.16, 0x9a9588, 0, 2.4, 0, 12));
  g.add(cyl(1.58, 1.58, 0.16, 0x9a9588, 0, 3.9, 0, 12));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.7, 12), toon(0x5a6b4a));
  roof.position.y = 6.15;
  roof.castShadow = true;
  g.add(roof);
  g.add(cyl(0.12, 0.12, 0.7, PALETTE.woodDeep, 0, 7.1, 0, 6));
  const flag = box(0.45, 0.28, 0.04, 0x6fbf8a, 0.22, 7.28, 0);
  g.add(flag);

  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 12, Math.PI), toon(PALETTE.woodDeep));
  arch.position.set(0, 1.45, 1.72);
  arch.rotation.x = Math.PI;
  g.add(arch);
  const door = box(0.85, 1.55, 0.12, PALETTE.woodDeep, 0, 0.85, 1.78);
  g.add(door);

  for (const y of [2.45, 3.85]) {
    prettyWindow(g, 0.95, y, 1.42, 0.5, 0.5, -0.4, false);
    prettyWindow(g, -0.95, y, 1.42, 0.5, 0.5, 0.4, false);
  }
  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), toon(PALETTE.grassDeep));
  moss.position.set(1.2, 1.15, 0.9);
  moss.scale.set(1.5, 0.45, 1.1);
  g.add(moss);
  g.add(box(0.5, 0.72, 0.18, 0x6fbf8a, -1.45, 0.42, 1.35));
  g.add(box(0.42, 0.55, 0.16, 0xe23a3a, -1.7, 0.34, 1.2));
  bush(g, -1.8, 1.6, 0.75);
  return g;
}

function stiltShop(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.45, 1.45]) {
    for (const z of [-1.15, 1.15]) {
      g.add(cyl(0.08, 0.11, 1.7, PALETTE.woodDeep, x, 0.85, z, 6));
    }
  }
  g.add(box(3.8, 0.16, 3.2, PALETTE.wood, 0, 1.68, 0));
  const wall = box(3.5, 2.05, 2.9, 0x3ecfcf, 0, 2.75, 0);
  g.add(wall);
  g.add(box(3.6, 0.1, 3.0, 0x2ab8b8, 0, 3.72, 0));

  const awning = box(4.0, 0.1, 1.55, 0xe23a3a, 0, 3.62, 1.55);
  awning.rotation.x = -0.32;
  g.add(awning);
  const stripe = box(4.0, 0.06, 1.55, 0xf2c14e, 0, 3.54, 1.55);
  stripe.rotation.x = -0.32;
  g.add(stripe);
  for (let i = 0; i < 6; i++) {
    const scallop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toon(i % 2 ? 0xe23a3a : 0xf2c14e));
    scallop.scale.set(1, 0.45, 1);
    scallop.position.set(-1.5 + i * 0.6, 3.18, 2.12);
    g.add(scallop);
  }

  prettyWindow(g, -1.05, 2.85, 1.48, 0.62, 0.7, 0, false);
  prettyWindow(g, 1.05, 2.85, 1.48, 0.62, 0.7, 0, false);
  g.add(box(0.78, 1.35, 0.08, 0xf2c14e, 0, 2.4, 1.48));
  const sign = box(1.1, 0.45, 0.08, 0xfff6ea, 0, 3.95, 1.7);
  g.add(sign);
  g.add(cyl(0.04, 0.04, 1.9, PALETTE.woodDeep, -1.7, 1.0, 1.4, 6));
  for (let i = 0; i < 5; i++) g.add(box(0.28, 0.06, 0.12, PALETTE.wood, -1.7, 0.25 + i * 0.28, 1.55));
  lantern(g, 1.55, 2.55, 1.55);
  return g;
}

function boatHouse(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(4.4, 0.28, 3.5, PALETTE.woodDeep, 0, 0.22, 0));
  const base = box(4.2, 2.05, 3.25, PALETTE.wood, 0, 1.35, 0);
  g.add(base, outlineClone(base, 0.02));
  const roofG = pitchedRoof(4.7, 3.5, 1.45, 0x1f3a5a, 0.28);
  roofG.position.y = 2.4;
  g.add(roofG);
  const gable = gableWall(4.2, 1.2, PALETTE.wood);
  gable.position.set(0, 2.4, 1.62);
  g.add(gable);
  prettyWindow(g, -1.25, 1.55, 1.68, 0.7, 0.75, 0, false);
  prettyWindow(g, 1.25, 1.55, 1.68, 0.7, 0.75, 0, false);
  g.add(box(1.15, 1.5, 0.1, PALETTE.woodDeep, 0, 0.95, 1.68));
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.15, 5, 5),
    new THREE.MeshBasicMaterial({ color: 0xdde8f0, wireframe: true, transparent: true, opacity: 0.7 }),
  );
  net.position.set(1.7, 1.25, 1.78);
  g.add(net);
  lantern(g, -1.55, 2.45, 1.72);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), toon(0xe23a3a));
  ring.position.set(-1.85, 1.35, 1.78);
  g.add(ring);
  for (const x of [-2.0, 2.0]) {
    g.add(cyl(0.09, 0.11, 1.4, PALETTE.woodDeep, x, 0.5, 2.2, 6));
  }
  g.add(box(3.2, 0.1, 1.1, PALETTE.wood, 0, 0.18, 2.35));
  return g;
}
