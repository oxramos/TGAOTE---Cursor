import * as THREE from "three";
import { ISLANDS, type IslandDef } from "../catalog";
import { PALETTE, toon } from "../materials";
import { fbm } from "../rng";
import { createHouse, type HouseKind } from "../models/houses";

export type HouseAnchor = {
  kind: HouseKind;
  island: string;
  position: THREE.Vector3;
  yaw: number;
};

const HOUSE_LAYOUT: Record<string, { kind: HouseKind; ox: number; oz: number; yaw: number; pad: number }> = {
  home: { kind: "home", ox: -10, oz: -8, yaw: 0.42, pad: 8.5 },
  meadow: { kind: "mallow", ox: -6, oz: -5, yaw: 0.2, pad: 7.2 },
  stone: { kind: "pebble", ox: 4, oz: -6, yaw: -0.28, pad: 6.5 },
  palm: { kind: "coral", ox: 6, oz: 5, yaw: 0.55, pad: 6.8 },
  harbor: { kind: "brine", ox: -4, oz: 9, yaw: 3.15, pad: 7.0 },
};

const LAND = 0.16;

export function coastRadius(isl: IslandDef, ang: number): number {
  const s = isl.seed * 0.17;
  const n1 = fbm(Math.cos(ang) * 2.2 + s, Math.sin(ang) * 2.2 - s);
  const n2 = fbm(Math.cos(ang * 2) * 1.35 + s, Math.sin(ang * 3) * 1.35);
  let k = 0.9 + 0.1 * n1 + 0.045 * (n2 - 0.5);
  switch (isl.biome) {
    case "home":
      k *= 1.04 + 0.1 * Math.cos(ang * 2 + 0.35);
      break;
    case "meadow":
      k *= 1.0 + 0.12 * Math.sin(ang * 2 - 0.4);
      break;
    case "stone":
      k *= 0.95 + 0.15 * Math.cos(ang * 3 + 0.7);
      break;
    case "harbor":
      k *= 1.0 + 0.18 * Math.cos(ang + 0.2);
      break;
    case "palm":
      k *= 1.0 + 0.15 * Math.sin(ang * 3);
      break;
    case "reef":
      k *= 0.86 + 0.24 * n1;
      break;
    case "rocks":
      k *= 0.84 + 0.18 * Math.abs(Math.sin(ang * 2.2));
      break;
  }
  return isl.radius * Math.max(0.7, k);
}

function rawHeight(isl: IslandDef, x: number, z: number): number {
  const dx = x - isl.x;
  const dz = z - isl.z;
  const d = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const R = coastRadius(isl, ang);
  if (d >= R) return 0;
  const t = d / R;
  const u = 1 - t;
  const n = fbm((x + isl.seed) * 0.045, (z - isl.seed) * 0.045);
  const n2 = fbm(x * 0.09 + 4, z * 0.09 - 2);

  const beach = THREE.MathUtils.smootherstep(0.78, 1, t);
  const sandH = 0.1 + 0.28 * (1 - beach);

  let interior = 0;
  switch (isl.biome) {
    case "home": {
      const rise = THREE.MathUtils.smootherstep(0.0, 0.72, u);
      interior = 0.38 + isl.height * rise * (0.78 + 0.22 * n);
      interior += (n2 - 0.5) * 0.28 * rise;
      break;
    }
    case "meadow": {
      const rise = THREE.MathUtils.smootherstep(0.0, 0.7, u);
      interior = 0.36 + isl.height * rise * (0.7 + 0.3 * n);
      interior += Math.sin(ang * 2 + n * 4) * 0.22 * rise;
      interior += (n2 - 0.45) * 0.35 * rise;
      break;
    }
    case "stone": {
      const mesa = THREE.MathUtils.smootherstep(0.18, 0.78, u);
      interior = 0.4 + isl.height * mesa;
      interior += (n - 0.5) * 0.35 * mesa;
      break;
    }
    case "harbor": {
      const rise = THREE.MathUtils.smootherstep(0.0, 0.65, u);
      interior = 0.32 + isl.height * rise * (0.85 + 0.15 * n);
      interior += (n2 - 0.5) * 0.18 * rise;
      break;
    }
    case "palm": {
      const rise = THREE.MathUtils.smootherstep(0.0, 0.68, u);
      const dune = Math.max(0, Math.sin(ang * 2 + 0.6)) * 0.55 * THREE.MathUtils.smootherstep(0.15, 0.55, u);
      interior = 0.34 + isl.height * rise * (0.75 + 0.25 * n) + dune;
      break;
    }
    case "reef": {
      const rise = THREE.MathUtils.smootherstep(0.0, 0.55, u);
      interior = 0.22 + isl.height * rise * (0.6 + 0.4 * n);
      interior += (n2 - 0.5) * 0.2;
      break;
    }
    case "rocks": {
      const cone = Math.pow(THREE.MathUtils.clamp(u, 0, 1), 1.65);
      interior = 0.28 + isl.height * cone;
      interior += (n - 0.5) * 0.4 * cone;
      break;
    }
  }

  const blend = THREE.MathUtils.smootherstep(0.0, 0.22, u);
  return THREE.MathUtils.lerp(sandH, interior, blend);
}

export function islandHeight(isl: IslandDef, x: number, z: number): number {
  let h = rawHeight(isl, x, z);
  const layout = HOUSE_LAYOUT[isl.id];
  if (layout && h > 0) {
    const px = isl.x + layout.ox;
    const pz = isl.z + layout.oz;
    const pd = Math.hypot(x - px, z - pz);
    if (pd < layout.pad) {
      const target = rawHeight(isl, px, pz);
      const w = 1 - THREE.MathUtils.smootherstep(layout.pad * 0.45, layout.pad, pd);
      h = THREE.MathUtils.lerp(h, target, w);
    }
  }
  return h;
}

export function heightAt(x: number, z: number): number {
  let h = 0;
  for (const isl of ISLANDS) h = Math.max(h, islandHeight(isl, x, z));
  return h;
}

export function isLand(x: number, z: number): boolean {
  return heightAt(x, z) > LAND;
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
  return best && bd < best.radius + 18 ? best : null;
}

export function beachPoint(isl: IslandDef, fromX: number, fromZ: number): THREE.Vector3 {
  const dx = fromX - isl.x;
  const dz = fromZ - isl.z;
  const ang = Math.atan2(dz, dx);
  const r = coastRadius(isl, ang) * 0.9;
  const x = isl.x + Math.cos(ang) * r;
  const z = isl.z + Math.sin(ang) * r;
  return new THREE.Vector3(x, heightAt(x, z), z);
}

export function berthPoint(isl: IslandDef, fromX: number, fromZ: number): THREE.Vector3 {
  const dx = fromX - isl.x;
  const dz = fromZ - isl.z;
  const ang = Math.atan2(dz, dx);
  for (let extra = 3.4; extra < 10; extra += 0.45) {
    const r = coastRadius(isl, ang) + extra;
    const x = isl.x + Math.cos(ang) * r;
    const z = isl.z + Math.sin(ang) * r;
    if (!isLand(x, z)) return new THREE.Vector3(x, 0.16, z);
  }
  const r = coastRadius(isl, ang) + 5;
  return new THREE.Vector3(isl.x + Math.cos(ang) * r, 0.16, isl.z + Math.sin(ang) * r);
}

export function pushToWater(x: number, z: number): { x: number; z: number } {
  if (!isLand(x, z)) return { x, z };
  const isl = nearestIsland(x, z);
  if (!isl) return { x, z };
  const ang = Math.atan2(z - isl.z, x - isl.x);
  for (let extra = 2.8; extra < 14; extra += 0.4) {
    const r = coastRadius(isl, ang) + extra;
    const nx = isl.x + Math.cos(ang) * r;
    const nz = isl.z + Math.sin(ang) * r;
    if (!isLand(nx, nz)) return { x: nx, z: nz };
  }
  return { x, z };
}

export function buildArchipelago(scene: THREE.Scene): { houses: HouseAnchor[]; colliders: { x: number; z: number; r: number }[] } {
  const houses: HouseAnchor[] = [];
  const colliders: { x: number; z: number; r: number }[] = [];

  for (const isl of ISLANDS) {
    scene.add(makeIslandMesh(isl));
    scene.add(makeIslandRim(isl));
    scatter(scene, isl);
    landmark(scene, isl);

    const layout = HOUSE_LAYOUT[isl.id];
    if (layout) {
      const pos = new THREE.Vector3(isl.x + layout.ox, 0, isl.z + layout.oz);
      pos.y = heightAt(pos.x, pos.z);
      const group = createHouse(layout.kind);
      group.position.copy(pos);
      group.rotation.y = layout.yaw;
      scene.add(group);
      houses.push({ kind: layout.kind, island: isl.id, position: pos.clone(), yaw: layout.yaw });
      const r = layout.kind === "home" ? 3.15 : layout.kind === "pebble" ? 2.4 : layout.kind === "coral" ? 2.5 : 2.85;
      colliders.push({ x: pos.x, z: pos.z, r });
    }
  }

  addSeaProps(scene);
  return { houses, colliders };
}

function makeIslandMesh(isl: IslandDef): THREE.Mesh {
  const radial = 72;
  const rings = 40;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const col = new THREE.Color();
  const sand = new THREE.Color(isl.biome === "palm" || isl.biome === "reef" ? 0xf6e2b8 : PALETTE.sand);
  const grass = new THREE.Color(
    isl.biome === "stone" ? 0x7a8f6a : isl.biome === "palm" ? 0x6fd46a : isl.biome === "meadow" ? 0x7ec85a : PALETTE.grass,
  );
  const dirt = new THREE.Color(PALETTE.dirt);
  const rock = new THREE.Color(PALETTE.stoneDeep);
  const moss = new THREE.Color(0x5a8a4a);

  for (let r = 0; r <= rings; r++) {
    const tt = r / rings;
    const segs = r === 0 ? 1 : radial;
    for (let a = 0; a < segs; a++) {
      const ang = (a / segs) * Math.PI * 2;
      const R = coastRadius(isl, ang);
      const rr = tt * R;
      const x = isl.x + Math.cos(ang) * rr;
      const z = isl.z + Math.sin(ang) * rr;
      const y = islandHeight(isl, x, z);
      positions.push(x, y, z);
      const t = tt;
      if (y < 0.38 || t > 0.84) col.copy(sand);
      else if (isl.biome === "stone" && y > isl.height * 0.55) col.copy(rock);
      else if (isl.biome === "rocks" && y > 1.4) col.copy(rock);
      else if (isl.biome === "harbor" && t > 0.5) col.copy(dirt);
      else if (isl.biome === "meadow") col.copy(grass).lerp(new THREE.Color(0xb5d96a), 0.2);
      else if (isl.biome === "reef") col.copy(sand).lerp(moss, 0.25);
      else col.copy(grass);
      col.offsetHSL(0, 0, (fbm(x * 0.18, z * 0.18) - 0.5) * 0.1);
      colors.push(col.r, col.g, col.b);
    }
  }

  const ringStart = (r: number) => (r === 0 ? 0 : 1 + (r - 1) * radial);
  for (let r = 0; r < rings; r++) {
    const a0 = ringStart(r);
    const a1 = ringStart(r + 1);
    if (r === 0) {
      for (let i = 0; i < radial; i++) indices.push(0, a1 + ((i + 1) % radial), a1 + i);
    } else {
      for (let i = 0; i < radial; i++) {
        const i0 = a0 + i;
        const i1 = a0 + ((i + 1) % radial);
        const j0 = a1 + i;
        const j1 = a1 + ((i + 1) % radial);
        indices.push(i0, i1, j0, i1, j1, j0);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function makeIslandRim(isl: IslandDef): THREE.Mesh {
  const radial = 72;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const sand = new THREE.Color(isl.biome === "palm" || isl.biome === "reef" ? 0xf6e2b8 : PALETTE.sand);
  const wet = new THREE.Color(PALETTE.sandWet);
  for (let a = 0; a <= radial; a++) {
    const ang = (a / radial) * Math.PI * 2;
    const R = coastRadius(isl, ang);
    const x = isl.x + Math.cos(ang) * R;
    const z = isl.z + Math.sin(ang) * R;
    const y = Math.max(islandHeight(isl, x, z), 0.04);
    positions.push(x, y, z, x, -1.55, z);
    colors.push(sand.r, sand.g, sand.b, wet.r, wet.g, wet.b);
  }
  for (let a = 0; a < radial; a++) {
    const i = a * 2;
    indices.push(i, i + 2, i + 1, i + 2, i + 3, i + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function slopeAt(isl: IslandDef, x: number, z: number): number {
  const h = islandHeight(isl, x, z);
  const hx = islandHeight(isl, x + 0.7, z);
  const hz = islandHeight(isl, x, z + 0.7);
  return Math.hypot(hx - h, hz - h) / 0.7;
}

function scatter(scene: THREE.Scene, isl: IslandDef) {
  const count = isl.biome === "reef" ? 8 : isl.biome === "rocks" ? 14 : 38;
  for (let i = 0; i < count; i++) {
    const a = fbm(isl.seed + i * 1.7, i * 3.1) * Math.PI * 2;
    const r = (0.22 + fbm(i * 0.9, isl.seed) * 0.55) * coastRadius(isl, a);
    const x = isl.x + Math.cos(a) * r;
    const z = isl.z + Math.sin(a) * r;
    const y = islandHeight(isl, x, z);
    if (y < 0.42) continue;
    if (slopeAt(isl, x, z) > 0.55) continue;
    if (isl.biome === "palm") scene.add(palm(x, y, z, 0.85 + fbm(x, z) * 0.45));
    else if (isl.biome === "stone" || isl.biome === "rocks") scene.add(boulder(x, y, z, 0.55 + fbm(z, x) * 0.7));
    else if (isl.biome !== "harbor") scene.add(tree(x, y, z, 0.95 + fbm(x, i) * 0.55, isl.biome === "meadow"));
  }
  if (isl.biome === "meadow") {
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + 0.2;
      const r = 5 + (i % 9) * 2.2;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const y = islandHeight(isl, x, z);
      if (y > 0.4) scene.add(flower(x, y, z, i));
    }
  }
  if (isl.biome === "home") {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 7 + (i % 5) * 1.6;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const y = islandHeight(isl, x, z);
      if (y > 0.45 && slopeAt(isl, x, z) < 0.4) scene.add(flower(x, y, z, i));
    }
  }
}

function landmark(scene: THREE.Scene, isl: IslandDef) {
  const sign = makeSign(isl.name === "Home Isle" ? "Home" : isl.name.split(" ")[0]);
  const sp = beachPoint(isl, isl.x + 24, isl.z + 10);
  sign.position.set(sp.x, sp.y, sp.z);
  scene.add(sign);

  if (isl.biome === "stone") {
    const arch = makeArch();
    arch.position.set(isl.x - 8, islandHeight(isl, isl.x - 8, isl.z + 4), isl.z + 4);
    scene.add(arch);
  }
  if (isl.biome === "home") {
    scene.add(makePier(isl, 0.32));
  }
  if (isl.biome === "harbor") {
    scene.add(makePier(isl, 1.55));
  }
  if (isl.biome === "rocks") {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const r = 3.2 + i * 0.4;
      scene.add(boulder(isl.x + Math.cos(a) * r, islandHeight(isl, isl.x, isl.z) * 0.4, isl.z + Math.sin(a) * r, 1.1 + i * 0.15));
    }
  }
}

function makePier(isl: IslandDef, ang: number): THREE.Group {
  const g = new THREE.Group();
  const R = coastRadius(isl, ang);
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  const px = -uz;
  const pz = ux;
  for (let i = 0; i < 9; i++) {
    const t = R * 0.86 + i * 0.85;
    const x = isl.x + ux * t;
    const z = isl.z + uz * t;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.78), toon(i % 2 ? PALETTE.wood : PALETTE.woodDeep));
    plank.position.set(x, 0.22, z);
    plank.rotation.y = -ang + Math.PI / 2;
    plank.castShadow = true;
    g.add(plank);
    if (i % 2 === 0) {
      for (const s of [-0.7, 0.7]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 6), toon(PALETTE.woodDeep));
        post.position.set(x + px * s, -0.15, z + pz * s);
        g.add(post);
      }
    }
  }
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0xffd36a, { emissive: 0xffc14a }));
  const tip = R * 0.86 + 8 * 0.85;
  lantern.position.set(isl.x + ux * tip, 0.85, isl.z + uz * tip);
  g.add(lantern);
  return g;
}

function tree(x: number, y: number, z: number, s: number, blossom: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.18 * s, 1.25 * s, 7), toon(PALETTE.woodDeep));
  trunk.position.y = 0.62 * s;
  trunk.rotation.z = (fbm(x, z) - 0.5) * 0.2;
  trunk.castShadow = true;
  g.add(trunk);
  const canopyCol = blossom ? 0xf4c6d7 : PALETTE.grassDeep;
  const puffs: [number, number, number, number][] = [
    [0, 1.55, 0, 0.95],
    [0.5, 1.38, 0.12, 0.72],
    [-0.46, 1.32, -0.18, 0.68],
    [0.12, 1.72, -0.4, 0.62],
    [-0.2, 1.65, 0.38, 0.58],
  ];
  for (const [ox, oy, oz, sc] of puffs) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(sc * s, 11, 9), toon(canopyCol));
    c.position.set(ox * s, oy * s, oz * s);
    c.castShadow = true;
    g.add(c);
  }
  return g;
}

function palm(x: number, y: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.16 * s, 2.7 * s, 7), toon(0xc4a06a));
  trunk.position.y = 1.35 * s;
  trunk.rotation.z = 0.14;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.58 * s, 8, 6), toon(i % 2 ? 0x4f9d5c : 0x3e8a4a));
    leaf.scale.set(1.85, 0.18, 0.55);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.55 * s, 2.65 * s, Math.sin(a) * 0.55 * s);
    leaf.rotation.y = a;
    leaf.rotation.z = 0.25;
    g.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 6, 6), toon(0x6a4028));
  nut.position.set(0.12, 2.55 * s, 0);
  g.add(nut);
  return g;
}

function boulder(x: number, y: number, z: number, s: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48 * s, 0), toon(PALETTE.stone));
  m.position.set(x, y + 0.22 * s, z);
  m.rotation.set(s, s * 2, 0.3);
  m.castShadow = true;
  return m;
}

function flower(x: number, y: number, z: number, i: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 4), toon(0x3e8f5a));
  stem.position.y = 0.12;
  const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon([0xff8ba7, 0xf2c14e, 0xffffff, 0x7ec8e8][i % 4]));
  petal.position.y = 0.26;
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
  const col = new THREE.Mesh(new THREE.BoxGeometry(0.75, 4.4, 0.75), mat);
  col.position.set(-2.3, 2.2, 0);
  const col2 = col.clone();
  col2.position.x = 2.3;
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.75, 0.85), mat);
  top.position.y = 4.45;
  const capL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.05), mat);
  capL.position.set(-2.3, 4.95, 0);
  const capR = capL.clone();
  capR.position.x = 2.3;
  g.add(col, col2, top, capL, capR);
  return g;
}

function addSeaProps(scene: THREE.Scene) {
  const spots = [
    [38, -52],
    [-72, 28],
    [62, 108],
    [-28, -62],
    [168, 14],
    [-108, -74],
    [28, 88],
  ];
  for (const [x, z] of spots) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), toon(PALETTE.stoneDeep));
    rock.position.set(x, 0.22, z);
    scene.add(rock);
  }
  for (let i = 0; i < 6; i++) {
    const buoy = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon(i % 2 ? 0xe23a3a : 0xf2c14e));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), toon(0xfff6ea));
    stick.position.y = 0.5;
    buoy.add(ball, stick);
    buoy.position.set(Math.cos(i) * 85, 0.3, Math.sin(i * 1.7) * 95);
    buoy.name = "buoy";
    scene.add(buoy);
  }
}
