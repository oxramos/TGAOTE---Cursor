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

function windowView(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#f7d7c4");
  g.addColorStop(0.42, "#b8d7f0");
  g.addColorStop(0.55, "#7ec8e8");
  g.addColorStop(1, "#3a7ca5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(255,246,234,0.55)";
  ctx.beginPath();
  ctx.ellipse(180, 70, 28, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6fbf6a";
  ctx.fillRect(0, 150, 256, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildInterior(kind: HouseKind): InteriorRoom {
  if (kind === "home") return homeInterior();

  const pal = WALLS[kind];
  const group = new THREE.Group();
  const w = 10;
  const d = 8;
  const h = 4.2;
  const floor = tbox(w, 0.12, d, texMat(planks(pal.floor)), 0, 0, 0);
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), toon(0xfff8ee));
  ceiling.position.y = h;
  group.add(ceiling);

  const wallMat = toon(pal.wall);
  wallMat.side = THREE.DoubleSide;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), wallMat);
  back.position.set(0, h / 2, -d / 2);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, d), wallMat);
  left.position.set(-w / 2, h / 2, 0);
  const right = left.clone();
  right.position.x = w / 2;
  const front = back.clone();
  front.position.z = d / 2;
  group.add(back, left, right, front);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ map: windowView() }));
  glass.position.set(-2.4, 2.3, -d / 2 + 0.1);
  group.add(glass);
  const glass2 = glass.clone();
  glass2.position.x = 2.4;
  group.add(glass2);

  const lamp = new THREE.PointLight(0xffe0b0, 0.55, 16);
  lamp.position.set(0, 3.2, 0);
  group.add(lamp);
  group.add(new THREE.HemisphereLight(0xfff1d6, 0x8a6a40, 1.1));
  const fill = new THREE.DirectionalLight(0xfff1d6, 0.7);
  fill.position.set(2, 5, 3);
  group.add(fill);

  const interacts: InteriorRoom["interacts"] = [];
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.08), toon(pal.trim));
  door.position.set(0, 1.05, d / 2 - 0.12);
  group.add(door);
  interacts.push({ kind: { type: "exit" }, position: new THREE.Vector3(0, 0, d / 2 - 1.1), label: "Leave" });

  const shelfAnchors: THREE.Object3D[] = [];
  const decorRoot = new THREE.Group();
  group.add(decorRoot);
  const npcAnchor = new THREE.Vector3(2.6, 0, -1.2);

  uniqueFurniture(kind, group);
  const npcMesh = createNpc(kind === "mallow" ? "mallow" : kind === "pebble" ? "pebble" : kind === "coral" ? "coral" : "brine");
  npcMesh.position.copy(npcAnchor);
  npcMesh.rotation.y = Math.PI;
  npcMesh.name = "interior-npc";
  group.add(npcMesh);
  const nid = kind as NpcId;
  interacts.push({ kind: { type: "npc", id: nid }, position: npcAnchor.clone(), label: `Talk to ${kind}` });

  return {
    id: kind,
    group,
    spawn: new THREE.Vector3(0, 0, 0.15),
    interacts,
    floor: { minX: -4.4, maxX: 4.4, minZ: -3.4, maxZ: 3.4 },
    shelfAnchors,
    decorRoot,
    npcAnchor,
  };
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
    spawn: new THREE.Vector3(0, 0, 2.15),
    interacts,
    floor: { minX: -4.15, maxX: 4.15, minZ: -3.2, maxZ: 3.15 },
    shelfAnchors,
    decorRoot,
    npcAnchor: new THREE.Vector3(2.4, 0, 1.2),
  };
}

function prettyInWindow(parent: THREE.Group, x: number, y: number, z: number, view: THREE.Material, rotY = 0) {
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
  root.add(box(1.35, 0.1, 0.16, PALETTE.roof, 0, -0.72, 0.04));
  root.add(box(0.18, 1.28, 0.05, PALETTE.roof, -0.72, 0, 0.05));
  root.add(box(0.18, 1.28, 0.05, PALETTE.roof, 0.72, 0, 0.05));
  parent.add(root);
}

function uniqueFurniture(kind: HouseKind, group: THREE.Group) {
  if (kind === "mallow") {
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(0xc0c8d0));
    kettle.position.set(-2.5, 0.7, -1);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 12), toon(PALETTE.wood));
    table.position.set(-2.5, 0.3, -1);
    const yarn = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon(0x7ec8e8));
    yarn.position.set(2.4, 0.35, 1.2);
    group.add(kettle, table, yarn);
  }
  if (kind === "pebble") {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 0.4), toon(PALETTE.woodDeep));
    shelf.position.set(-3.2, 1.4, -1);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 10), toon(0x88d4c4));
    jar.position.set(2.2, 0.5, -1.5);
    group.add(shelf, jar);
  }
  if (kind === "coral") {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.1), toon(0xe23a3a));
    counter.position.set(0, 0.45, -1.8);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), toon(0xf2c14e));
    crate.position.set(3, 0.3, 1);
    group.add(counter, crate);
  }
  if (kind === "brine") {
    const hammock = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.9), toon(0xf4e6c8));
    hammock.position.set(-2.4, 1.1, 0);
    hammock.rotation.z = 0.12;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), toon(0xf0d9b5));
    map.position.set(2.6, 2.2, -3.85);
    group.add(hammock, map);
  }
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
