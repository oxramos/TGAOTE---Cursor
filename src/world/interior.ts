import * as THREE from "three";
import { toon, PALETTE } from "../materials";
import { createItemVisual } from "../models/items";
import { createNpc } from "../models/animals";
import { clapboard, planks, shingles, stoneBlocks, texMat } from "../models/houses";
import { SHELF_SLOTS } from "../catalog";
import type { HouseKind } from "../models/houses";
import type { NpcId } from "../types";

export type InteriorInteract =
  | { type: "exit" }
  | { type: "sleep" }
  | { type: "shelf"; index: number }
  | { type: "npc"; id: NpcId };

export type InteriorRoom = {
  id: HouseKind;
  group: THREE.Group;
  spawn: THREE.Vector3;
  interacts: { kind: InteriorInteract; position: THREE.Vector3; label: string }[];
  floor: { minX: number; maxX: number; minZ: number; maxZ: number };
  shelfAnchors: THREE.Object3D[];
  decorRoot: THREE.Group;
  npcAnchor: THREE.Vector3;
};

const WALLS: Record<HouseKind, { wall: number; floor: number; trim: number }> = {
  home: { wall: PALETTE.cottage, floor: PALETTE.wood, trim: PALETTE.roof },
  mallow: { wall: 0xffe4ef, floor: 0xf4d7c8, trim: 0xe56b9e },
  pebble: { wall: 0xd9d3c4, floor: 0x8d8778, trim: 0x5a6b4a },
  coral: { wall: 0x9be7e0, floor: 0xf2c14e, trim: 0xe23a3a },
  brine: { wall: 0xc49a6c, floor: 0x8a5a32, trim: 0x1f3a5a },
};

function heartShape(s = 1): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, s * 0.35);
  sh.bezierCurveTo(-s * 0.15, s * 0.7, -s * 0.7, s * 0.55, -s * 0.7, s * 0.1);
  sh.bezierCurveTo(-s * 0.7, -s * 0.25, 0, -s * 0.55, 0, -s * 0.85);
  sh.bezierCurveTo(0, -s * 0.55, s * 0.7, -s * 0.25, s * 0.7, s * 0.1);
  sh.bezierCurveTo(s * 0.7, s * 0.55, s * 0.15, s * 0.7, 0, s * 0.35);
  return sh;
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

function windowView(kind: "home" | "meadow" | "stone" | "palm" | "harbor" = "home"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  if (kind === "meadow") {
    g.addColorStop(0, "#f8d5e8");
    g.addColorStop(0.4, "#c5e4f4");
    g.addColorStop(0.55, "#9ad48a");
    g.addColorStop(1, "#6fbf6a");
  } else if (kind === "stone") {
    g.addColorStop(0, "#d7dde8");
    g.addColorStop(0.45, "#9bb0c4");
    g.addColorStop(0.6, "#7a8b6a");
    g.addColorStop(1, "#5a6b4a");
  } else if (kind === "palm") {
    g.addColorStop(0, "#ffe2a8");
    g.addColorStop(0.4, "#7ed6e8");
    g.addColorStop(0.55, "#3ecfcf");
    g.addColorStop(1, "#1a7ca5");
  } else if (kind === "harbor") {
    g.addColorStop(0, "#c9d8ea");
    g.addColorStop(0.4, "#6a90b8");
    g.addColorStop(0.55, "#2f5f8a");
    g.addColorStop(1, "#1f3a5a");
  } else {
    g.addColorStop(0, "#f7d7c4");
    g.addColorStop(0.42, "#b8d7f0");
    g.addColorStop(0.55, "#7ec8e8");
    g.addColorStop(1, "#3a7ca5");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(255,246,234,0.55)";
  ctx.beginPath();
  ctx.ellipse(180, 70, 28, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "palm") {
    ctx.fillStyle = "#2a9d6a";
    ctx.fillRect(20, 140, 18, 90);
    ctx.beginPath();
    ctx.ellipse(28, 140, 36, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildInterior(kind: HouseKind): InteriorRoom {
  if (kind === "home") return homeInterior();
  if (kind === "mallow") return mallowInterior();
  if (kind === "pebble") return pebbleInterior();
  if (kind === "coral") return coralInterior();
  return brineInterior();
}

function homeInterior(): InteriorRoom {
  const group = new THREE.Group();
  const w = 9.4;
  const d = 7.8;
  const wallH = 3.15;
  const rise = 1.75;
  const siding = texMat(clapboard(PALETTE.cottage));
  const floorMat = texMat(planks(PALETTE.wood));
  const trim = 0xfff1dc;
  const roof = PALETTE.roof;
  const view = new THREE.MeshBasicMaterial({ map: windowView() });

  group.add(tbox(w, 0.14, d, floorMat, 0, 0.02, 0));
  group.add(tbox(w + 0.2, 0.08, d + 0.2, texMat(stoneBlocks(PALETTE.stone)), 0, -0.06, 0));

  const wallMat = siding;
  const back = tbox(w, wallH, 0.18, wallMat, 0, wallH / 2, -d / 2);
  const front = tbox(w, wallH, 0.18, wallMat, 0, wallH / 2, d / 2);
  const left = tbox(0.18, wallH, d, wallMat, -w / 2, wallH / 2, 0);
  const right = tbox(0.18, wallH, d, wallMat, w / 2, wallH / 2, 0);
  group.add(back, front, left, right);

  group.add(box(w, 0.92, 0.12, trim, 0, 0.5, -d / 2 + 0.12));
  group.add(box(w, 0.92, 0.12, trim, 0, 0.5, d / 2 - 0.12));
  group.add(box(0.12, 0.92, d, trim, -w / 2 + 0.12, 0.5, 0));
  group.add(box(0.12, 0.92, d, trim, w / 2 - 0.12, 0.5, 0));
  group.add(box(w, 0.08, 0.1, roof, 0, 0.96, -d / 2 + 0.14));
  group.add(box(w, 0.08, 0.1, roof, 0, 0.96, d / 2 - 0.14));

  const hypot = Math.hypot(w / 2, rise);
  const ang = Math.atan2(rise, w / 2);
  const roofMat = texMat(shingles(roof));
  for (const side of [-1, 1] as const) {
    const panel = tbox(hypot + 0.15, 0.1, d + 0.2, roofMat, side * (w / 4), wallH + rise / 2, 0);
    panel.rotation.z = side === -1 ? ang : -ang;
    group.add(panel);
  }
  const gable = (z: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, 0);
    sh.lineTo(0, rise);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false });
    geo.translate(0, 0, -0.08);
    const m = new THREE.Mesh(geo, siding);
    m.position.set(0, wallH, z);
    group.add(m);
  };
  gable(-d / 2);
  gable(d / 2);

  for (let i = 0; i < 4; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, d - 0.4, 6), toon(PALETTE.woodDeep));
    beam.rotation.x = Math.PI / 2;
    beam.position.set(-2.4 + i * 1.6, wallH + 0.35, 0);
    group.add(beam);
  }

  prettyInWindow(group, -2.15, 1.85, -d / 2 + 0.12, view);
  prettyInWindow(group, 2.15, 1.85, -d / 2 + 0.12, view);
  prettyInWindow(group, -w / 2 + 0.12, 1.85, 0.4, view, Math.PI / 2);
  prettyInWindow(group, w / 2 - 0.12, 1.85, 0.4, view, -Math.PI / 2);

  group.add(new THREE.HemisphereLight(0xfff1d6, 0x8a6040, 1.05));
  const sun = new THREE.DirectionalLight(0xffe8c4, 0.55);
  sun.position.set(2.5, 4.5, 2);
  sun.castShadow = true;
  group.add(sun);
  const lamp = new THREE.PointLight(0xffd4a0, 0.7, 14);
  lamp.position.set(0, 2.8, 0);
  group.add(lamp);

  const interacts: InteriorRoom["interacts"] = [];
  group.add(box(1.28, 2.15, 0.12, 0x2a1014, 0, 1.12, d / 2 - 0.08));
  group.add(box(1.12, 2.02, 0.08, roof, 0, 1.12, d / 2 - 0.16));
  group.add(box(0.42, 0.55, 0.04, 0x7a1c22, -0.22, 0.85, d / 2 - 0.22));
  group.add(box(0.42, 0.55, 0.04, 0x7a1c22, 0.22, 0.85, d / 2 - 0.22));
  const doorHeart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.16), { depth: 0.04, bevelEnabled: false }).center(),
    toon(0xf4b3c8, { emissive: 0xe89ab0 }),
  );
  doorHeart.position.set(0, 1.55, d / 2 - 0.22);
  group.add(doorHeart);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), toon(0xf2c14e));
  knob.position.set(0.38, 1.05, d / 2 - 0.22);
  group.add(knob);
  interacts.push({ kind: { type: "exit" }, position: new THREE.Vector3(0, 0, d / 2 - 1.25), label: "Leave" });

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.04, 28), toon(0xe23a3a));
  rug.position.set(0.15, 0.1, 0.35);
  group.add(rug);
  const rugInner = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.045, 28), toon(0xfff1dc));
  rugInner.position.set(0.15, 0.12, 0.35);
  group.add(rugInner);
  const rugHeart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.35), { depth: 0.02, bevelEnabled: false }).center(),
    toon(0xe23a3a),
  );
  rugHeart.rotation.x = -Math.PI / 2;
  rugHeart.position.set(0.15, 0.15, 0.35);
  group.add(rugHeart);

  const brick = texMat(stoneBlocks(0xb85a4a));
  group.add(tbox(1.85, 2.55, 0.55, brick, -3.55, 1.3, -1.35));
  group.add(box(1.15, 0.95, 0.2, 0x1a1010, -3.55, 0.85, -1.08));
  group.add(box(0.7, 0.12, 0.22, PALETTE.woodDeep, -3.55, 0.38, -1.05));
  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), toon(0xff8a3d, { emissive: 0xff6a1a }));
  fire.position.set(-3.55, 0.62, -1.05);
  group.add(fire);
  const hearthLight = new THREE.PointLight(0xff7a3a, 0.55, 7);
  hearthLight.position.set(-3.2, 1.1, -1.0);
  group.add(hearthLight);
  group.add(box(2.05, 0.12, 0.7, PALETTE.stoneDeep, -3.55, 2.6, -1.35));
  group.add(tbox(0.55, 0.7, 0.55, brick, -3.55, 3.05, -1.35));

  const bedFrame = tbox(2.05, 0.28, 2.55, texMat(planks(PALETTE.woodDeep)), 3.15, 0.28, -1.55);
  const mattress = box(1.92, 0.28, 2.35, 0xfff6ea, 3.15, 0.54, -1.55);
  const quilt = box(1.92, 0.1, 1.65, PALETTE.skirt, 3.15, 0.7, -1.28);
  const quiltTrim = box(1.92, 0.04, 0.18, 0xfff1dc, 3.15, 0.76, -0.52);
  const pillow = box(0.7, 0.18, 0.48, 0xfff1dc, 2.85, 0.78, -2.45);
  const pillow2 = box(0.55, 0.14, 0.4, 0xf4b3c8, 3.45, 0.76, -2.42);
  group.add(bedFrame, mattress, quilt, quiltTrim, pillow, pillow2);
  group.add(box(2.05, 0.85, 0.12, trim, 3.15, 0.9, -2.78));
  const bedHeart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.14), { depth: 0.03, bevelEnabled: false }).center(),
    toon(0xe23a3a),
  );
  bedHeart.position.set(3.15, 1.15, -2.7);
  group.add(bedHeart);
  group.add(tbox(0.55, 0.52, 0.55, texMat(planks(PALETTE.wood)), 2.05, 0.32, -2.55));
  const bedLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  bedLamp.position.set(2.05, 0.72, -2.55);
  group.add(bedLamp);
  interacts.push({ kind: { type: "sleep" }, position: new THREE.Vector3(3.15, 0, -1.4), label: "Sleep until morning" });

  const shelfAnchors: THREE.Object3D[] = [];
  const hutch = new THREE.Group();
  hutch.add(tbox(4.55, 2.85, 0.16, siding, 0, 1.85, -d / 2 + 0.32));
  hutch.add(box(4.7, 0.1, 0.5, roof, 0, 3.3, -d / 2 + 0.42));
  hutch.add(box(4.7, 0.08, 0.48, trim, 0, 0.48, -d / 2 + 0.42));
  for (const x of [-2.2, 2.2]) hutch.add(box(0.1, 2.85, 0.48, trim, x, 1.85, -d / 2 + 0.42));
  for (let row = 0; row < 3; row++) {
    const y = 0.85 + row * 0.78;
    hutch.add(tbox(4.35, 0.08, 0.42, texMat(planks(PALETTE.wood)), 0, y, -d / 2 + 0.5));
    for (let col = 0; col < 4; col++) {
      const anchor = new THREE.Object3D();
      const index = row * 4 + col;
      anchor.position.set(-1.52 + col * 1.02, y + 0.22, -d / 2 + 0.52);
      anchor.userData.slot = index;
      hutch.add(anchor);
      shelfAnchors.push(anchor);
      interacts.push({
        kind: { type: "shelf", index },
        position: new THREE.Vector3(-1.52 + col * 1.02, 0, -d / 2 + 1.2),
        label: "Arrange a treasure",
      });
    }
  }
  group.add(hutch);

  group.add(tbox(1.45, 0.08, 1.45, texMat(planks(PALETTE.wood)), -1.15, 0.72, 1.15));
  for (const [x, z] of [
    [-1.65, 0.7],
    [-0.65, 0.7],
    [-1.65, 1.6],
    [-0.65, 1.6],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8), toon(PALETTE.woodDeep));
    leg.position.set(x, 0.38, z);
    group.add(leg);
  }
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), toon(0xc0c8d0));
  kettle.position.set(-1.15, 0.92, 1.15);
  group.add(kettle);
  group.add(box(0.16, 0.12, 0.16, 0xfff6ea, -0.92, 0.82, 1.32));
  group.add(box(0.16, 0.12, 0.16, 0xfff6ea, -1.35, 0.82, 1.0));

  const chair = (x: number, z: number, yaw: number) => {
    const g = new THREE.Group();
    g.add(box(0.48, 0.08, 0.48, PALETTE.wood, 0, 0.42, 0));
    g.add(box(0.48, 0.55, 0.08, PALETTE.wood, 0, 0.72, -0.2));
    for (const sx of [-0.18, 0.18]) {
      for (const sz of [-0.18, 0.18]) g.add(box(0.06, 0.4, 0.06, PALETTE.woodDeep, sx, 0.2, sz));
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    group.add(g);
  };
  chair(-1.15, 2.05, Math.PI);
  chair(-1.15, 0.25, 0);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.22, 10), toon(PALETTE.wood));
  pot.position.set(3.4, 0.22, 1.55);
  const clover = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(PALETTE.grass));
  clover.position.set(3.4, 0.42, 1.55);
  group.add(pot, clover);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  lantern.position.set(1.6, 2.55, 1.8);
  group.add(lantern);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), toon(PALETTE.woodDeep));
  cord.position.set(1.6, 2.85, 1.8);
  group.add(cord);

  const decorRoot = new THREE.Group();
  group.add(decorRoot);

  return {
    id: "home",
    group,
    spawn: new THREE.Vector3(0, 0, 0.7),
    interacts,
    floor: { minX: -4.15, maxX: 4.15, minZ: -3.2, maxZ: 3.15 },
    shelfAnchors,
    decorRoot,
    npcAnchor: new THREE.Vector3(2.4, 0, 1.2),
  };
}

function prettyInWindow(parent: THREE.Group, x: number, y: number, z: number, view: THREE.Material, rotY = 0, trim = PALETTE.roof) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;
  root.add(box(1.28, 1.42, 0.08, 0x2a1014, 0, 0, -0.04));
  root.add(box(1.18, 1.32, 0.06, 0xfff1dc, 0, 0, 0.02));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.12), view);
  glass.position.z = 0.06;
  root.add(glass);
  root.add(box(0.05, 1.12, 0.05, 0xfff1dc, 0, 0, 0.08));
  root.add(box(1.02, 0.05, 0.05, 0xfff1dc, 0, 0, 0.08));
  root.add(box(1.35, 0.1, 0.16, trim, 0, -0.72, 0.04));
  root.add(box(0.18, 1.28, 0.05, trim, -0.72, 0, 0.05));
  root.add(box(0.18, 1.28, 0.05, trim, 0.72, 0, 0.05));
  parent.add(root);
}

function roomLights(group: THREE.Group, color: number, y = 2.85) {
  group.add(new THREE.HemisphereLight(0xfff1d6, 0x8a6a40, 1.05));
  const lamp = new THREE.PointLight(color, 0.72, 14);
  lamp.position.set(0, y, 0);
  group.add(lamp);
  const fill = new THREE.DirectionalLight(0xfff1d6, 0.5);
  fill.position.set(2.2, 4.6, 2.4);
  group.add(fill);
}

function addNpc(group: THREE.Group, id: NpcId, x: number, z: number, interacts: InteriorRoom["interacts"], label: string) {
  const mesh = createNpc(id);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = Math.PI;
  mesh.name = "interior-npc";
  group.add(mesh);
  interacts.push({ kind: { type: "npc", id }, position: new THREE.Vector3(x, 0, z), label });
}

function yarnBall(color: number, x: number, y: number, z: number, s = 0.22) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), toon(color));
  m.position.set(x, y, z);
  return m;
}

function bookStack(x: number, z: number, cols: number[]) {
  const g = new THREE.Group();
  cols.forEach((c, i) => {
    const b = box(0.28 + (i % 2) * 0.06, 0.08, 0.38, c, 0, 0.08 + i * 0.09, 0);
    g.add(b);
  });
  g.position.set(x, 0, z);
  return g;
}

function mallowInterior(): InteriorRoom {
  const group = new THREE.Group();
  const w = 8.6;
  const d = 8.2;
  const wallH = 3.05;
  const wool = texMat(clapboard(0xfff0e8));
  const floorM = texMat(planks(0xf4d7c8));
  const view = new THREE.MeshBasicMaterial({ map: windowView("meadow") });
  group.add(tbox(w, 0.14, d, floorM, 0, 0.02, 0));
  group.add(tbox(w, wallH, 0.2, wool, 0, wallH / 2, -d / 2));
  group.add(tbox(w, wallH, 0.2, wool, 0, wallH / 2, d / 2));
  group.add(tbox(0.2, wallH, d, wool, -w / 2, wallH / 2, 0));
  group.add(tbox(0.2, wallH, d, wool, w / 2, wallH / 2, 0));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(5.4, 1.6, 16), texMat(shingles(0xf4c6d7)));
  cap.position.y = wallH + 0.55;
  group.add(cap);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), toon(i % 2 ? 0xfff6ea : 0xffd6e6));
    puff.position.set(Math.cos(a) * 3.9, 1.4 + (i % 3) * 0.55, Math.sin(a) * 3.6);
    group.add(puff);
  }
  prettyInWindow(group, -1.7, 1.7, -d / 2 + 0.12, view, 0, 0xe56b9e);
  prettyInWindow(group, 1.7, 1.7, -d / 2 + 0.12, view, 0, 0xe56b9e);
  const round = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), view);
  round.position.set(w / 2 - 0.12, 1.85, 0.2);
  round.rotation.y = -Math.PI / 2;
  group.add(round);
  group.add(box(1.15, 2.05, 0.1, 0xe56b9e, 0, 1.05, d / 2 - 0.08));
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 14), toon(0x7bc47a));
  wreath.position.set(0, 1.55, d / 2 - 0.16);
  group.add(wreath);
  roomLights(group, 0xffc6d8);
  const interacts: InteriorRoom["interacts"] = [];
  interacts.push({ kind: { type: "exit" }, position: new THREE.Vector3(0, 0, d / 2 - 1.2), label: "Leave" });

  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.62, 14), toon(PALETTE.wood));
  table.position.set(-2.15, 0.34, -0.9);
  group.add(table);
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), toon(0xc0c8d0));
  kettle.position.set(-2.15, 0.82, -0.9);
  group.add(kettle);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6), toon(0xc0c8d0));
  spout.rotation.z = 0.8;
  spout.position.set(-1.95, 0.86, -0.9);
  group.add(spout);
  group.add(yarnBall(0x7ec8e8, 2.35, 0.28, 1.15, 0.28));
  group.add(yarnBall(0xe56b9e, 2.65, 0.22, 1.45, 0.2));
  group.add(yarnBall(0xfff6ea, 2.1, 0.2, 1.5, 0.16));
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.28, 10), toon(PALETTE.wood));
  basket.position.set(2.4, 0.18, 1.35);
  group.add(basket);
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), toon(0xf4c6d7));
  cushion.scale.set(1.3, 0.35, 1.1);
  cushion.position.set(-2.4, 0.22, 1.55);
  group.add(cushion);
  const cushion2 = cushion.clone();
  cushion2.material = toon(0x7ec8e8);
  cushion2.position.set(-1.85, 0.22, 1.85);
  group.add(cushion2);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  lantern.position.set(1.6, 2.35, -1.4);
  group.add(lantern);
  const needles = box(0.04, 0.55, 0.04, 0xc0c8d0, 2.55, 0.45, 1.2);
  needles.rotation.z = 0.4;
  group.add(needles);
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.04, 20), toon(0xe56b9e));
  rug.position.set(0.1, 0.1, 0.2);
  group.add(rug);
  const npcAnchor = new THREE.Vector3(1.8, 0, -1.15);
  addNpc(group, "mallow", npcAnchor.x, npcAnchor.z, interacts, "Talk to Mallow");
  const decorRoot = new THREE.Group();
  group.add(decorRoot);
  return {
    id: "mallow",
    group,
    spawn: new THREE.Vector3(0, 0, 0.85),
    interacts,
    floor: { minX: -3.7, maxX: 3.7, minZ: -3.4, maxZ: 3.4 },
    shelfAnchors: [],
    decorRoot,
    npcAnchor,
  };
}

function pebbleInterior(): InteriorRoom {
  const group = new THREE.Group();
  const w = 8.8;
  const d = 8.4;
  const wallH = 3.35;
  const stone = texMat(stoneBlocks(PALETTE.stone));
  const deep = texMat(stoneBlocks(PALETTE.stoneDeep));
  const view = new THREE.MeshBasicMaterial({ map: windowView("stone") });
  group.add(tbox(w, 0.16, d, deep, 0, 0.02, 0));
  group.add(tbox(w, wallH, 0.22, stone, 0, wallH / 2, -d / 2));
  group.add(tbox(w, wallH, 0.22, stone, 0, wallH / 2, d / 2));
  group.add(tbox(0.22, wallH, d, stone, -w / 2, wallH / 2, 0));
  group.add(tbox(0.22, wallH, d, stone, w / 2, wallH / 2, 0));
  group.add(tbox(w + 0.3, 0.12, d + 0.3, texMat(shingles(0x5a6b4a)), 0, wallH + 0.06, 0));
  prettyInWindow(group, -1.85, 2.05, -d / 2 + 0.14, view, 0, 0x5a6b4a);
  prettyInWindow(group, 1.85, 2.05, -d / 2 + 0.14, view, 0, 0x5a6b4a);
  group.add(box(1.2, 2.15, 0.12, PALETTE.woodDeep, 0, 1.1, d / 2 - 0.1));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 12, Math.PI), deep);
  arch.rotation.z = Math.PI;
  arch.position.set(0, 2.05, d / 2 - 0.16);
  group.add(arch);
  roomLights(group, 0xc8e0b0, 3.05);
  const interacts: InteriorRoom["interacts"] = [];
  interacts.push({ kind: { type: "exit" }, position: new THREE.Vector3(0, 0, d / 2 - 1.2), label: "Leave" });

  const shelf = (x: number, z: number, yaw: number) => {
    const g = new THREE.Group();
    g.add(tbox(2.6, 2.55, 0.28, texMat(planks(PALETTE.woodDeep)), 0, 1.4, 0));
    const cols = [0x6fbf8a, 0xe23a3a, 0xf2c14e, 0x3a7ca5, 0xc45ad4, 0xfff6ea, 0x5a6b4a];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        g.add(box(0.14, 0.32, 0.08, cols[(row + col) % cols.length], -1.05 + col * 0.36, 0.55 + row * 0.52, 0.16));
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    group.add(g);
  };
  shelf(-3.55, -0.4, Math.PI / 2);
  shelf(3.55, -0.2, -Math.PI / 2);
  const desk = tbox(1.85, 0.12, 0.9, texMat(planks(PALETTE.wood)), -1.1, 0.72, -1.7);
  group.add(desk);
  for (const x of [-1.7, -0.5]) group.add(box(0.08, 0.7, 0.08, PALETTE.woodDeep, x, 0.35, -1.95));
  group.add(bookStack(-1.35, -1.55, [0x3a7ca5, 0xfff6ea, 0x6fbf8a]));
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 10), toon(0x88d4c4, { transparent: true, opacity: 0.7 }));
  jar.position.set(-0.55, 0.95, -1.55);
  group.add(jar);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), toon(0xc9c4b8));
  rock.position.set(-0.55, 1.12, -1.55);
  group.add(rock);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0x9ed96a, { emissive: 0x6fbf6a }));
  lamp.position.set(-1.55, 1.02, -1.85);
  group.add(lamp);
  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toon(PALETTE.grassDeep));
  moss.scale.set(1.4, 0.35, 1.1);
  moss.position.set(2.15, 0.22, 1.7);
  group.add(moss);
  group.add(bookStack(2.05, -1.85, [0xe23a3a, 0x5a6b4a, 0xf2c14e, 0x3a7ca5]));
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), toon(0x3a7ca5));
  globe.position.set(1.85, 0.95, -1.7);
  group.add(globe);
  group.add(box(0.08, 0.7, 0.08, PALETTE.woodDeep, 1.85, 0.4, -1.7));
  const npcAnchor = new THREE.Vector3(1.55, 0, 0.35);
  addNpc(group, "pebble", npcAnchor.x, npcAnchor.z, interacts, "Talk to Pebble");
  const decorRoot = new THREE.Group();
  group.add(decorRoot);
  return {
    id: "pebble",
    group,
    spawn: new THREE.Vector3(0, 0, 0.9),
    interacts,
    floor: { minX: -3.8, maxX: 3.8, minZ: -3.5, maxZ: 3.5 },
    shelfAnchors: [],
    decorRoot,
    npcAnchor,
  };
}

function coralInterior(): InteriorRoom {
  const group = new THREE.Group();
  const w = 8.4;
  const d = 7.6;
  const wallH = 2.85;
  const plank = texMat(planks(0x3ecfcf));
  const wood = texMat(planks(PALETTE.wood));
  const view = new THREE.MeshBasicMaterial({ map: windowView("palm") });
  group.add(tbox(w, 0.12, d, wood, 0, 0.04, 0));
  group.add(tbox(w, wallH, 0.16, plank, 0, wallH / 2, -d / 2));
  group.add(tbox(0.16, wallH, d, plank, -w / 2, wallH / 2, 0));
  group.add(tbox(0.16, wallH, d, plank, w / 2, wallH / 2, 0));
  group.add(tbox(w, wallH, 0.16, plank, 0, wallH / 2, d / 2));
  const thatch = new THREE.Mesh(new THREE.ConeGeometry(5.2, 1.55, 8), texMat(shingles(0xd4a44a)));
  thatch.position.y = wallH + 0.5;
  group.add(thatch);
  prettyInWindow(group, -1.9, 1.65, -d / 2 + 0.12, view, 0, 0xe23a3a);
  prettyInWindow(group, 1.9, 1.65, -d / 2 + 0.12, view, 0, 0xe23a3a);
  group.add(box(1.35, 2.05, 0.1, 0xe23a3a, 0, 1.05, d / 2 - 0.08));
  const awning = tbox(3.6, 0.08, 1.2, texMat(shingles(0xe23a3a)), 0, 2.55, 1.85);
  awning.rotation.x = -0.22;
  group.add(awning);
  roomLights(group, 0xffc14a);
  const interacts: InteriorRoom["interacts"] = [];
  interacts.push({ kind: { type: "exit" }, position: new THREE.Vector3(0, 0, d / 2 - 1.15), label: "Leave" });

  const counter = tbox(3.6, 0.92, 1.05, texMat(planks(0xe23a3a)), 0, 0.5, -1.55);
  group.add(counter);
  group.add(tbox(3.7, 0.08, 1.15, wood, 0, 0.98, -1.55));
  const goods = [0xf2c14e, 0x7ec8e8, 0xff8ba7, 0x7bc47a, 0xe23a3a];
  goods.forEach((c, i) => {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toon(c));
    shell.scale.set(1, 0.45, 1.1);
    shell.position.set(-1.2 + i * 0.6, 1.12, -1.45);
    group.add(shell);
  });
  const crate = (x: number, z: number, c: number) => {
    group.add(tbox(0.72, 0.55, 0.72, texMat(planks(c)), x, 0.32, z));
  };
  crate(2.55, 1.15, 0xf2c14e);
  crate(2.55, 1.85, PALETTE.wood);
  crate(-2.65, 1.35, 0xe23a3a);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 1.6), toon(0xe23a3a));
  rug.position.set(-0.2, 0.1, 0.55);
  group.add(rug);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.045, 0.22), toon(0xf2c14e));
  stripe.position.set(-0.2, 0.12, 0.55);
  group.add(stripe);
  for (let i = 0; i < 5; i++) {
    const hang = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(goods[i]));
    hang.position.set(-1.2 + i * 0.55, 2.15, -1.15);
    group.add(hang);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5), toon(PALETTE.woodDeep));
    cord.position.set(-1.2 + i * 0.55, 2.38, -1.15);
    group.add(cord);
  }
  const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), toon(PALETTE.woodDeep));
  perch.rotation.z = Math.PI / 2;
  perch.position.set(2.15, 1.55, -0.35);
  group.add(perch);
  const npcAnchor = new THREE.Vector3(0.15, 0, -0.55);
  addNpc(group, "coral", npcAnchor.x, npcAnchor.z, interacts, "Talk to Coral");
  const decorRoot = new THREE.Group();
  group.add(decorRoot);
  return {
    id: "coral",
    group,
    spawn: new THREE.Vector3(0, 0, 1.05),
    interacts,
    floor: { minX: -3.6, maxX: 3.6, minZ: -3.15, maxZ: 3.15 },
    shelfAnchors: [],
    decorRoot,
    npcAnchor,
  };
}

function brineInterior(): InteriorRoom {
  const group = new THREE.Group();
  const w = 8.2;
  const d = 9.4;
  const wallH = 3.05;
  const plank = texMat(planks(PALETTE.wood));
  const deep = texMat(planks(PALETTE.woodDeep));
  const view = new THREE.MeshBasicMaterial({ map: windowView("harbor") });
  group.add(tbox(w, 0.14, d, deep, 0, 0.02, 0));
  group.add(tbox(w, wallH, 0.18, plank, 0, wallH / 2, -d / 2));
  group.add(tbox(w, wallH, 0.18, plank, 0, wallH / 2, d / 2));
  group.add(tbox(0.18, wallH, d, plank, -w / 2, wallH / 2, 0));
  group.add(tbox(0.18, wallH, d, plank, w / 2, wallH / 2, 0));
  const roof = texMat(shingles(0x1f3a5a));
  group.add(tbox(w + 0.4, 0.12, d + 0.3, roof, 0, wallH + 0.2, 0));
  prettyInWindow(group, -1.7, 1.75, -d / 2 + 0.12, view, 0, 0x1f3a5a);
  prettyInWindow(group, 1.7, 1.75, -d / 2 + 0.12, view, 0, 0x1f3a5a);
  group.add(tbox(0.95, 2.05, 0.1, deep, -0.7, 1.05, d / 2 - 0.1));
  const doorR = tbox(0.95, 2.05, 0.1, deep, 0.72, 1.05, d / 2 - 0.16);
  doorR.rotation.y = -0.35;
  group.add(doorR);
  roomLights(group, 0xffb070, 2.7);
  const interacts: InteriorRoom["interacts"] = [];
  interacts.push({ kind: { type: "exit" }, position: new THREE.Vector3(0, 0, d / 2 - 1.25), label: "Leave" });

  const hammock = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.85), toon(0xf4e6c8));
  hammock.position.set(-2.15, 1.15, -0.35);
  hammock.rotation.z = 0.14;
  group.add(hammock);
  group.add(box(0.06, 1.15, 0.06, PALETTE.woodDeep, -3.15, 0.6, -0.35));
  group.add(box(0.06, 1.35, 0.06, PALETTE.woodDeep, -1.15, 0.7, -0.35));
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.05), toon(0xf0d9b5));
  chart.position.set(2.55, 1.95, -d / 2 + 0.2);
  group.add(chart);
  group.add(box(1.7, 0.06, 0.06, 0x1f3a5a, 2.55, 2.5, -d / 2 + 0.22));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 8, 16), toon(PALETTE.wood));
  wheel.position.set(2.35, 1.35, 0.85);
  group.add(wheel);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), toon(PALETTE.woodDeep));
    spoke.rotation.z = (i / 6) * Math.PI;
    spoke.position.copy(wheel.position);
    group.add(spoke);
  }
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 8, 14), toon(PALETTE.wood));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(-2.45, 0.22, 1.55);
  group.add(coil);
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.1, 5, 5),
    new THREE.MeshBasicMaterial({ color: 0xdde8f0, wireframe: true, transparent: true, opacity: 0.7 }),
  );
  net.position.set(3.15, 1.45, 1.55);
  net.rotation.y = -0.4;
  group.add(net);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  lantern.position.set(-2.4, 2.25, 1.8);
  group.add(lantern);
  const crate = tbox(0.85, 0.5, 0.7, texMat(planks(PALETTE.wood)), 2.45, 0.3, -1.55);
  group.add(crate);
  group.add(box(0.22, 0.16, 0.22, 0xfff6ea, 2.45, 0.62, -1.55));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 14), toon(0xe23a3a));
  ring.position.set(-3.15, 1.35, 2.15);
  group.add(ring);
  const npcAnchor = new THREE.Vector3(1.15, 0, -1.15);
  addNpc(group, "brine", npcAnchor.x, npcAnchor.z, interacts, "Talk to Captain Brine");
  const decorRoot = new THREE.Group();
  group.add(decorRoot);
  return {
    id: "brine",
    group,
    spawn: new THREE.Vector3(0, 0, 1.2),
    interacts,
    floor: { minX: -3.55, maxX: 3.55, minZ: -4.0, maxZ: 3.95 },
    shelfAnchors: [],
    decorRoot,
    npcAnchor,
  };
}

export function fillShelf(room: InteriorRoom, displayed: (string | null)[]) {
  for (let i = 0; i < SHELF_SLOTS; i++) {
    const anchor = room.shelfAnchors[i];
    if (!anchor) continue;
    while (anchor.children.length) anchor.remove(anchor.children[0]);
    const id = displayed[i];
    if (!id) continue;
    const vis = createItemVisual(id);
    vis.scale.setScalar(0.85);
    anchor.add(vis);
  }
}

export function rebuildDecor(room: InteriorRoom, decorations: { id: string; x: number; z: number; rot: number }[]) {
  room.decorRoot.clear();
  for (const d of decorations) {
    const vis = createItemVisual(d.id);
    vis.position.set(d.x, 0.2, d.z);
    vis.rotation.y = d.rot;
    vis.scale.setScalar(1.1);
    vis.userData.decor = true;
    room.decorRoot.add(vis);
  }
}
