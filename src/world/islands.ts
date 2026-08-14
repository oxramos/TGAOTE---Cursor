import * as THREE from "three";
import { ISLANDS, type IslandDef } from "../catalog";
import { PALETTE, toon } from "../materials";
import { fbm } from "../rng";
import { createHouse, type HouseKind } from "../models/houses";

export function islandHeight(isl: IslandDef, x: number, z: number): number {
  const dx = x - isl.x;
  const dz = z - isl.z;
  const d = Math.hypot(dx, dz);
  if (d > isl.radius) return 0;
  const n = fbm((x + isl.seed) * 0.08, (z - isl.seed) * 0.08);
  const sharp = isl.biome === "stone" || isl.biome === "rocks" ? 0.78 : 0.62;
  const edge = 1 - THREE.MathUtils.smoothstep(isl.radius * sharp, isl.radius, d);
  let h = isl.height * Math.pow(edge, isl.biome === "stone" ? 0.7 : 1.15) * (0.55 + 0.45 * n);
  if (isl.biome === "home") {
    const path = Math.abs(dz) < 1.4 && dx > -2 && dx < 8 ? 0.35 : 1;
    h *= path === 0.35 ? 0.55 : 1;
  }
  if (d > isl.radius * 0.78) h = Math.min(h, 0.22 + (1 - d / isl.radius) * 0.5);
  return Math.max(h, d < isl.radius * 0.98 ? 0.08 : 0);
}

export function heightAt(x: number, z: number): number {
  let h = 0;
  for (const isl of ISLANDS) h = Math.max(h, islandHeight(isl, x, z));
  return h;
}

export function nearestIsland(x: number, z: number): IslandDef | null {
  let best: IslandDef | null = null;
  let bd = Infinity;
  for (const isl of ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d < bd) {
      bd = d;
      best = isl;
    }
  }
  return best && bd < best.radius + 14 ? best : null;
}

export function beachPoint(isl: IslandDef, fromX: number, fromZ: number): THREE.Vector3 {
  const dx = fromX - isl.x;
  const dz = fromZ - isl.z;
  const len = Math.hypot(dx, dz) || 1;
  const r = isl.radius * 0.86;
  const x = isl.x + (dx / len) * r;
  const z = isl.z + (dz / len) * r;
  return new THREE.Vector3(x, heightAt(x, z), z);
}

export type HouseAnchor = {
  kind: HouseKind;
  island: string;
  position: THREE.Vector3;
  yaw: number;
};

export function buildArchipelago(scene: THREE.Scene): { houses: HouseAnchor[]; colliders: { x: number; z: number; r: number }[] } {
  const houses: HouseAnchor[] = [];
  const colliders: { x: number; z: number; r: number }[] = [];

  for (const isl of ISLANDS) {
    scene.add(makeIslandMesh(isl));
    scatter(scene, isl);
    landmark(scene, isl);

    const house = houseFor(isl);
    if (house) {
      const pos = new THREE.Vector3(isl.x + house.ox, 0, isl.z + house.oz);
      pos.y = heightAt(pos.x, pos.z);
      const group = createHouse(house.kind);
      group.position.copy(pos);
      group.rotation.y = house.yaw;
      scene.add(group);
      houses.push({ kind: house.kind, island: isl.id, position: pos.clone(), yaw: house.yaw });
      colliders.push({ x: pos.x, z: pos.z, r: house.kind === "pebble" ? 2.2 : 2.6 });
    }
  }

  addSeaProps(scene);
  return { houses, colliders };
}

function houseFor(isl: IslandDef): { kind: HouseKind; ox: number; oz: number; yaw: number } | null {
  if (isl.id === "home") return { kind: "home", ox: -6, oz: -4, yaw: 0.4 };
  if (isl.id === "meadow") return { kind: "mallow", ox: -3, oz: -2, yaw: 0.2 };
  if (isl.id === "stone") return { kind: "pebble", ox: 2, oz: -4, yaw: -0.3 };
  if (isl.id === "palm") return { kind: "coral", ox: 3, oz: 2, yaw: 0.6 };
  if (isl.id === "harbor") return { kind: "brine", ox: -2, oz: 4, yaw: 3.2 };
  return null;
}

function makeIslandMesh(isl: IslandDef): THREE.Mesh {
  const radial = 48;
  const rings = 28;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const col = new THREE.Color();
  const sand = new THREE.Color(PALETTE.sand);
  const grass = new THREE.Color(isl.biome === "stone" ? 0x7a8f6a : isl.biome === "palm" ? 0x88d46a : PALETTE.grass);
  const dirt = new THREE.Color(PALETTE.dirt);
  const rock = new THREE.Color(PALETTE.stoneDeep);

  for (let r = 0; r <= rings; r++) {
    const rr = (r / rings) * isl.radius;
    const segs = r === 0 ? 1 : radial;
    for (let a = 0; a < segs; a++) {
      const ang = (a / segs) * Math.PI * 2;
      const x = isl.x + Math.cos(ang) * rr;
      const z = isl.z + Math.sin(ang) * rr;
      const y = islandHeight(isl, x, z);
      positions.push(x, y, z);
      const t = rr / isl.radius;
      if (y < 0.28 || t > 0.82) col.copy(sand);
      else if (isl.biome === "stone" && y > isl.height * 0.45) col.copy(rock);
      else if (isl.biome === "harbor" && t > 0.55) col.copy(dirt);
      else col.copy(grass);
      col.offsetHSL(0, 0, (fbm(x * 0.2, z * 0.2) - 0.5) * 0.08);
      colors.push(col.r, col.g, col.b);
    }
  }

  const ringStart = (r: number) => {
    if (r === 0) return 0;
    return 1 + (r - 1) * radial;
  };
  for (let r = 0; r < rings; r++) {
    const a0 = ringStart(r);
    const a1 = ringStart(r + 1);
    const n0 = r === 0 ? 1 : radial;
    const n1 = radial;
    if (r === 0) {
      for (let i = 0; i < radial; i++) {
        indices.push(0, a1 + i, a1 + ((i + 1) % radial));
      }
    } else {
      for (let i = 0; i < radial; i++) {
        const i0 = a0 + i;
        const i1 = a0 + ((i + 1) % n0);
        const j0 = a1 + i;
        const j1 = a1 + ((i + 1) % n1);
        indices.push(i0, j0, i1, i1, j0, j1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function scatter(scene: THREE.Scene, isl: IslandDef) {
  const count = isl.biome === "reef" || isl.biome === "rocks" ? 6 : 22;
  for (let i = 0; i < count; i++) {
    const a = fbm(isl.seed + i, i * 3) * Math.PI * 2;
    const r = (0.25 + fbm(i, isl.seed) * 0.5) * isl.radius;
    const x = isl.x + Math.cos(a) * r;
    const z = isl.z + Math.sin(a) * r;
    const y = islandHeight(isl, x, z);
    if (y < 0.35) continue;
    if (isl.biome === "palm") scene.add(palm(x, y, z, 0.8 + fbm(x, z)));
    else if (isl.biome === "stone" || isl.biome === "rocks") scene.add(boulder(x, y, z, 0.5 + fbm(z, x)));
    else if (isl.biome !== "harbor") scene.add(tree(x, y, z, 0.9 + fbm(x, i) * 0.5, isl.biome === "meadow"));
  }
  if (isl.biome === "meadow") {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + 0.2;
      const r = 4 + (i % 7) * 1.8;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const y = islandHeight(isl, x, z);
      if (y > 0.3) scene.add(flower(x, y, z, i));
    }
  }
}

function landmark(scene: THREE.Scene, isl: IslandDef) {
  const sign = makeSign(isl.name === "Home Isle" ? "Home" : "Island Checkpoint");
  const sp = beachPoint(isl, isl.x + 20, isl.z + 8);
  sign.position.set(sp.x, sp.y, sp.z);
  scene.add(sign);

  if (isl.biome === "stone") {
    const arch = makeArch();
    arch.position.set(isl.x - 6, islandHeight(isl, isl.x - 6, isl.z + 3), isl.z + 3);
    scene.add(arch);
  }
  if (isl.biome === "home") {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 6.5), toon(PALETTE.wood));
    dock.position.set(isl.x + 10, 0.22, isl.z + 6);
    scene.add(dock);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.1, 6), toon(PALETTE.woodDeep));
    post.position.set(isl.x + 10.6, 0.6, isl.z + 8.6);
    scene.add(post);
  }
  if (isl.biome === "rocks") {
    const stack = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 7), toon(PALETTE.stoneDeep));
    stack.position.set(isl.x, 3.2, isl.z);
    scene.add(stack);
  }
}

function tree(x: number, y: number, z: number, s: number, blossom: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.1 * s, 6), toon(PALETTE.woodDeep));
  trunk.position.y = 0.55 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const canopyCol = blossom ? 0xf4c6d7 : PALETTE.grassDeep;
  for (const [ox, oy, oz, sc] of [
    [0, 1.4, 0, 0.9],
    [0.45, 1.25, 0.1, 0.7],
    [-0.4, 1.2, -0.15, 0.65],
  ] as const) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(sc * s, 10, 8), toon(canopyCol));
    c.position.set(ox * s, oy * s, oz * s);
    c.castShadow = true;
    g.add(c);
  }
  return g;
}

function palm(x: number, y: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 2.4 * s, 6), toon(0xc4a06a));
  trunk.position.y = 1.2 * s;
  trunk.rotation.z = 0.12;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 8, 6), toon(0x4f9d5c));
    leaf.scale.set(1.6, 0.25, 0.5);
    leaf.position.set(Math.cos((i / 5) * 6.2) * 0.5, 2.4 * s, Math.sin((i / 5) * 6.2) * 0.5);
    leaf.rotation.y = (i / 5) * Math.PI * 2;
    g.add(leaf);
  }
  return g;
}

function boulder(x: number, y: number, z: number, s: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 * s, 0), toon(PALETTE.stone));
  m.position.set(x, y + 0.2, z);
  m.rotation.set(s, s * 2, 0.3);
  m.castShadow = true;
  return m;
}

function flower(x: number, y: number, z: number, i: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 4), toon(0x3e8f5a));
  stem.position.y = 0.11;
  const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon([0xff8ba7, 0xf2c14e, 0xffffff, 0x7ec8e8][i % 4]));
  petal.position.y = 0.24;
  g.add(stem, petal);
  return g;
}

function makeSign(text: string): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), toon(PALETTE.woodDeep));
  post.position.y = 0.55;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.08), toon(PALETTE.wood));
  board.position.y = 1.15;
  g.add(post, board);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c48a4a";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#2a1a12";
  ctx.font = "bold 28px serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 74);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
  label.position.set(0, 1.15, 0.05);
  g.add(label);
  return g;
}

function makeArch(): THREE.Group {
  const g = new THREE.Group();
  const mat = toon(0xe8e4da);
  const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), mat);
  col.position.set(-2.2, 2.1, 0);
  const col2 = col.clone();
  col2.position.x = 2.2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.7, 0.8), mat);
  top.position.y = 4.3;
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.55), mat);
  mid.position.set(0, 1.6, 0);
  g.add(col, col2, top, mid);
  return g;
}

function addSeaProps(scene: THREE.Scene) {
  const spots = [
    [30, -40],
    [-60, 20],
    [50, 90],
    [-20, -50],
    [140, 10],
    [-90, -60],
    [20, 70],
  ];
  for (const [x, z] of spots) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), toon(PALETTE.stoneDeep));
    rock.position.set(x, 0.2, z);
    scene.add(rock);
  }
  for (let i = 0; i < 6; i++) {
    const buoy = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon(i % 2 ? 0xe23a3a : 0xf2c14e));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), toon(0xfff6ea));
    stick.position.y = 0.5;
    buoy.add(ball, stick);
    buoy.position.set(Math.cos(i) * 70, 0.3, Math.sin(i * 1.7) * 80);
    buoy.name = "buoy";
    scene.add(buoy);
  }
}
