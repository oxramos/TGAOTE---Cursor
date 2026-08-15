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

const LAND = 0.16;

const HOUSE_LAYOUT: Record<string, { kind: HouseKind; ox: number; oz: number; yaw: number; pad: number }> = {
  home: { kind: "home", ox: -8, oz: -10, yaw: 0.42, pad: 7.6 },
  meadow: { kind: "mallow", ox: -7, oz: -6, yaw: 0.2, pad: 6.4 },
  stone: { kind: "pebble", ox: 6, oz: -8, yaw: 2.05, pad: 7.4 },
  palm: { kind: "coral", ox: 8, oz: 6, yaw: 0.55, pad: 6.2 },
  harbor: { kind: "brine", ox: -5, oz: 11, yaw: 3.15, pad: 6.6 },
};

export function yardPoint() {
  const layout = HOUSE_LAYOUT.home;
  const isl = ISLANDS[0];
  return {
    x: isl.x + layout.ox - 4.5 + 1.6,
    z: isl.z + layout.oz + 3.2 + 0.2,
  };
}

export function coastRadius(isl: IslandDef, ang: number): number {
  const s = isl.seed * 0.17;
  const n1 = fbm(Math.cos(ang) * 2.2 + s, Math.sin(ang) * 2.2 - s);
  const n2 = fbm(Math.cos(ang * 2) * 1.35 + s, Math.sin(ang * 3) * 1.35);
  let k = 0.88 + 0.12 * n1 + 0.06 * (n2 - 0.5);
  switch (isl.biome) {
    case "home":
      k *= 1.06 + 0.16 * Math.cos(ang * 2 + 0.4);
      break;
    case "meadow":
      k *= 1.02 + 0.22 * Math.sin(ang * 2 - 0.35);
      break;
    case "stone":
      k *= 0.94 + 0.2 * Math.cos(ang * 3 + 0.7) + 0.06 * Math.sin(ang * 5);
      break;
    case "harbor":
      k *= 0.92 + 0.28 * Math.cos(ang + 0.15);
      break;
    case "palm":
      k *= 1.0 + 0.2 * Math.sin(ang * 3) + 0.08 * Math.cos(ang);
      break;
    case "reef":
      k *= 0.82 + 0.28 * n1;
      break;
    case "rocks":
      k *= 0.8 + 0.22 * Math.abs(Math.sin(ang * 2.4));
      break;
  }
  return isl.radius * Math.max(0.62, k);
}

function rawHeight(isl: IslandDef, x: number, z: number): number {
  const dx = x - isl.x;
  const dz = z - isl.z;
  const d = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const R = coastRadius(isl, ang);
  if (d >= R) return 0;
  const t = d / R;
  const n = fbm((x + isl.seed) * 0.038, (z - isl.seed) * 0.038);
  const n2 = fbm(x * 0.07 + 4, z * 0.07 - 2);
  const n3 = fbm(x * 0.15, z * 0.15);

  // A sandy skirt, then hills that actually rise — not a pancake.
  const beachT = isl.biome === "reef" ? 0.28 : isl.biome === "rocks" ? 0.12 : 0.16;
  const lip = isl.biome === "reef" ? 0.42 : isl.biome === "rocks" ? 0.55 : 0.72;
  if (t > 1 - beachT) {
    const b = (t - (1 - beachT)) / beachT;
    const wet = 0.05 + 0.06 * n3;
    return THREE.MathUtils.lerp(lip, wet, THREE.MathUtils.smootherstep(0, 1, b));
  }

  const u = 1 - t / (1 - beachT);

  switch (isl.biome) {
    case "home": {
      let h = lip + isl.height * Math.pow(u, 0.78);
      h += 3.15 * Math.exp(-Math.pow((ang - 0.95) / 0.68, 2)) * Math.pow(u, 0.82);
      h += 2.05 * Math.exp(-Math.pow((ang + 2.05) / 0.75, 2)) * Math.pow(u, 0.9);
      const bowl = Math.exp(-Math.pow((ang - 2.6) / 0.65, 2)) * Math.pow(u, 0.7);
      h -= bowl * 1.45;
      h += Math.sin(d * 0.1 + ang * 2) * 0.85 * u;
      h += (n2 - 0.5) * 0.95 * u;
      return h;
    }
    case "meadow": {
      const rolls = Math.sin(ang * 2.4 + n * 2.2) * 2.45 + Math.sin(d * 0.1 + ang) * 1.55;
      const ridge = Math.exp(-Math.pow((ang + 0.8) / 0.5, 2)) * 3.4 * Math.pow(u, 0.72);
      return lip + isl.height * Math.pow(u, 0.82) * (0.48 + 0.52 * n) + rolls * Math.pow(u, 0.58) + ridge;
    }
    case "stone": {
      const spine = 0.5 + 0.62 * Math.pow(Math.abs(Math.cos(ang - 0.55)), 1.05);
      const cliff = Math.exp(-Math.pow((ang - 0.55) / 0.36, 2)) * 4.6 * Math.pow(u, 0.58);
      const terrace = Math.sin(d * 0.18) * 1.15 * u;
      return lip + isl.height * Math.pow(u, 0.78) * spine + cliff + terrace + (n - 0.5) * 1.35 * u;
    }
    case "harbor": {
      const cove = Math.max(0, Math.cos(ang + 0.15));
      const back = 1 - cove * 0.82;
      const quay = Math.pow(u, 1.15) * 1.85 * (1 - cove);
      return lip * (0.4 + 0.6 * (1 - cove)) + isl.height * Math.pow(u, 0.85) * back * (0.75 + 0.25 * n) + quay;
    }
    case "palm": {
      const dune = Math.max(0, Math.sin(ang * 2 + 0.45)) * 3.35 * Math.pow(Math.sin(Math.PI * u), 0.95);
      const lagoon = Math.exp(-Math.pow((ang - 2.2) / 0.65, 2)) * 1.55 * Math.pow(1 - u, 0.55);
      return lip + isl.height * Math.pow(u, 0.85) * (0.32 + 0.38 * n) + dune - lagoon;
    }
    case "reef": {
      const rim = Math.exp(-Math.pow((t - 0.48) / 0.14, 2)) * 3.05;
      const inner = 0.7 + isl.height * Math.pow(Math.max(0, u - 0.12), 1.05) * (0.5 + 0.5 * n);
      return 0.5 + rim + inner + (n2 - 0.5) * 0.22;
    }
    case "rocks": {
      const stack = isl.height * Math.pow(u, 0.7);
      const cap = u > 0.62 ? THREE.MathUtils.lerp(stack, isl.height * 0.92, (u - 0.62) / 0.38) : stack;
      const rib = Math.abs(Math.sin(ang * 2.2)) * 1.55 * u;
      return 0.35 + cap + rib + (n - 0.5) * 0.55 * u;
    }
  }
  return lip;
}

export function islandHeight(isl: IslandDef, x: number, z: number): number {
  let h = rawHeight(isl, x, z);
  const layout = HOUSE_LAYOUT[isl.id];
  if (layout && h > 0) {
    const hx = isl.x + layout.ox;
    const hz = isl.z + layout.oz;
    const yaw = layout.yaw;
    const dx = x - hx;
    const dz = z - hz;
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const houseH = rawHeight(isl, hx, hz);
    const body = Math.hypot(lx / (layout.pad * 0.72), lz / (layout.pad * 0.62));
    const path = Math.max(Math.abs(lx) / 2.8, Math.abs(lz - 5.4) / 6.2);
    const u = Math.min(body, path);
    if (u < 1) {
      const w = 1 - THREE.MathUtils.smootherstep(0.12, 1, u);
      h = THREE.MathUtils.lerp(h, houseH, w * 0.94);
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

export const PIER_ANG: Record<string, number> = {
  home: 0.32,
  harbor: 1.55,
  meadow: 2.4,
  stone: -0.55,
  palm: 3.4,
};

export function houseWorldOffset(h: { position: THREE.Vector3; yaw: number }, lx: number, lz: number) {
  return {
    x: h.position.x + lx * Math.cos(h.yaw) + lz * Math.sin(h.yaw),
    z: h.position.z - lx * Math.sin(h.yaw) + lz * Math.cos(h.yaw),
  };
}

export function pierCleat(isl: IslandDef, ang: number): THREE.Vector3 {
  const R = coastRadius(isl, ang);
  const t = R * 0.86 + 8 * 0.85;
  return new THREE.Vector3(isl.x + Math.cos(ang) * t, 0.52, isl.z + Math.sin(ang) * t);
}

export function pierBerth(isl: IslandDef, ang: number): THREE.Vector3 {
  const R = coastRadius(isl, ang);
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  for (let extra = 2.4; extra < 12; extra += 0.35) {
    const t = R * 0.86 + 8 * 0.85 + extra;
    const x = isl.x + ux * t;
    const z = isl.z + uz * t;
    if (!isLand(x, z)) return new THREE.Vector3(x, 0.16, z);
  }
  return berthPoint(isl, isl.x + ux * (R + 10), isl.z + uz * (R + 10));
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
      const yaw = layout.yaw;
      if (layout.kind === "home") {
        const main = houseWorldOffset({ position: pos, yaw }, 0.15, -0.45);
        colliders.push({ x: main.x, z: main.z, r: 2.42 });
        const wing = houseWorldOffset({ position: pos, yaw }, 3.55, -0.35);
        colliders.push({ x: wing.x, z: wing.z, r: 1.45 });
      } else {
        const r = layout.kind === "pebble" ? 1.62 : layout.kind === "coral" ? 1.95 : layout.kind === "mallow" ? 2.15 : 2.15;
        const body = houseWorldOffset({ position: pos, yaw }, 0, -0.25);
        colliders.push({ x: body.x, z: body.z, r });
      }
    }
  }

  addSeaProps(scene);
  return { houses, colliders };
}

function makeIslandMesh(isl: IslandDef): THREE.Mesh {
  const radial = 96;
  const rings = 56;
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
  const tip = new THREE.Color(PALETTE.grassTip);

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
      const hx = islandHeight(isl, x + 0.55, z);
      const hz = islandHeight(isl, x, z + 0.55);
      const slope = Math.hypot(hx - y, hz - y) / 0.55;
      const coastAmt = THREE.MathUtils.smoothstep(0.78, 0.98, tt);
      const lowAmt = THREE.MathUtils.smoothstep(0.62, 0.16, y);
      let sandAmt = THREE.MathUtils.clamp(coastAmt * 0.95 + lowAmt * 0.3, 0, 1);
      const rockAmt = THREE.MathUtils.smoothstep(0.42, 0.95, slope);
      if (isl.biome === "stone") {
        col.copy(grass).lerp(rock, THREE.MathUtils.clamp(rockAmt * 0.7 + tt * 0.15, 0, 1));
        col.lerp(sand, sandAmt);
      } else if (isl.biome === "rocks") {
        col.copy(rock).lerp(sand, sandAmt);
      } else if (isl.biome === "harbor") {
        col.copy(dirt).lerp(sand, sandAmt * 0.75);
        col.lerp(grass, (1 - sandAmt) * 0.5 * (1 - rockAmt));
      } else if (isl.biome === "reef") {
        col.copy(sand).lerp(moss, (1 - sandAmt) * 0.4);
      } else if (isl.biome === "palm") {
        col.copy(grass).lerp(sand, THREE.MathUtils.clamp(sandAmt + (1 - tt) * 0.12, 0, 1));
        col.lerp(dirt, rockAmt * 0.35);
      } else {
        col.copy(grass).lerp(tip, fbm(x * 0.12, z * 0.12) * 0.28 * (1 - sandAmt));
        col.lerp(sand, sandAmt);
        col.lerp(dirt, rockAmt * (1 - sandAmt) * 0.4);
      }
      col.offsetHSL(0, 0, (fbm(x * 0.2, z * 0.2) - 0.5) * 0.08);
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
  const radial = 96;
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
  const layout = HOUSE_LAYOUT[isl.id];
  const count = isl.biome === "reef" ? 10 : isl.biome === "rocks" ? 18 : 62;
  for (let i = 0; i < count; i++) {
    const a = fbm(isl.seed + i * 1.7, i * 3.1) * Math.PI * 2;
    const r = (0.18 + fbm(i * 0.9, isl.seed) * 0.62) * coastRadius(isl, a);
    const x = isl.x + Math.cos(a) * r;
    const z = isl.z + Math.sin(a) * r;
    if (layout && Math.hypot(x - (isl.x + layout.ox), z - (isl.z + layout.oz)) < layout.pad + 1.2) continue;
    const y = islandHeight(isl, x, z);
    if (y < 0.55) continue;
    if (slopeAt(isl, x, z) > 0.62) continue;
    if (isl.biome === "palm") scene.add(palm(x, y, z, 0.85 + fbm(x, z) * 0.45));
    else if (isl.biome === "stone") {
      if (i % 3 === 0) scene.add(boulder(x, y, z, 0.7 + fbm(z, x) * 0.5));
    } else if (isl.biome === "rocks") scene.add(boulder(x, y, z, 0.55 + fbm(z, x) * 0.7));
    else if (isl.biome !== "harbor") scene.add(tree(x, y, z, 0.95 + fbm(x, i) * 0.55, isl.biome === "meadow"));
  }
  if (isl.biome === "meadow") {
    for (let i = 0; i < 110; i++) {
      const a = (i / 110) * Math.PI * 2 + 0.2;
      const r = 6 + (i % 11) * 2.4;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const y = islandHeight(isl, x, z);
      if (y > 0.5) scene.add(flower(x, y, z, i));
    }
  }
  if (isl.biome === "home") {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 8 + (i % 6) * 1.7;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const y = islandHeight(isl, x, z);
      if (y > 0.55 && slopeAt(isl, x, z) < 0.45) scene.add(flower(x, y, z, i));
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
    const layout = HOUSE_LAYOUT.stone;
    const hx = isl.x + layout.ox;
    const hz = isl.z + layout.oz;
    const yaw = layout.yaw;
    for (let i = 0; i < 14; i++) {
      const lz = 2.0 + i * 0.82;
      const o = {
        x: hx + lz * Math.sin(yaw),
        z: hz + lz * Math.cos(yaw),
      };
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.72), toon(i % 2 ? PALETTE.stone : PALETTE.stoneDeep));
      slab.position.set(o.x, islandHeight(isl, o.x, o.z) + 0.06, o.z);
      slab.rotation.y = yaw;
      scene.add(slab);
    }
    for (let i = 0; i < 6; i++) {
      const a = -0.15 + i * 0.32;
      const r = 16 + i * 2.4;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const cliff = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2 + i * 0.55, 1.05), toon(PALETTE.stoneDeep));
      cliff.position.set(x, islandHeight(isl, x, z) + 1.8, z);
      cliff.rotation.y = a + Math.PI / 2;
      scene.add(cliff);
    }
  }
  if (isl.biome === "home") {
    scene.add(makePier(isl, 0.32));
    scene.add(makeClothesline(isl));
    const pondX = isl.x + 18;
    const pondZ = isl.z - 8;
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.08, 16), toon(0x3a90d4));
    pond.position.set(pondX, islandHeight(isl, pondX, pondZ) + 0.02, pondZ);
    scene.add(pond);
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 5), toon(PALETTE.grassDeep));
    reed.position.set(pondX + 1.6, islandHeight(isl, pondX + 1.6, pondZ) + 0.55, pondZ + 0.4);
    scene.add(reed);
    const knollX = isl.x + 22;
    const knollZ = isl.z + 16;
    const knoll = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8), toon(PALETTE.grass));
    knoll.scale.set(1.4, 0.42, 1.15);
    knoll.position.set(knollX, islandHeight(isl, knollX, knollZ) + 0.4, knollZ);
    scene.add(knoll);
  }
  if (isl.biome === "harbor") {
    scene.add(makePier(isl, 1.55));
    for (let i = 0; i < 8; i++) {
      const a = 1.55 + (i - 3.5) * 0.12;
      const r = coastRadius(isl, a) + 1.1;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.7), toon(PALETTE.stoneDeep));
      wall.position.set(x, 0.42, z);
      wall.rotation.y = a;
      scene.add(wall);
    }
  }
  if (isl.biome === "meadow") {
    scene.add(makePier(isl, 2.4));
    const ridgeX = isl.x - 10;
    const ridgeZ = isl.z + 18;
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(6.5, 14, 10), toon(PALETTE.grass));
    ridge.scale.set(1.55, 0.38, 1.1);
    ridge.position.set(ridgeX, islandHeight(isl, ridgeX, ridgeZ) + 0.55, ridgeZ);
    scene.add(ridge);
    for (let i = 0; i < 16; i++) {
      const a = 0.4 + i * 0.12;
      const r = 16 + (i % 3) * 1.4;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const hedge = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), toon(i % 2 ? PALETTE.grass : PALETTE.grassDeep));
      hedge.position.set(x, islandHeight(isl, x, z) + 0.4, z);
      hedge.scale.set(1.3, 0.7, 0.8);
      scene.add(hedge);
    }
  }
  if (isl.biome === "stone") scene.add(makePier(isl, -0.55));
  if (isl.biome === "palm") {
    scene.add(makePier(isl, 3.4));
    for (let i = 0; i < 5; i++) {
      const a = 0.4 + i * 0.7;
      const r = 10 + (i % 3) * 3.2;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), toon(0xf6e2b8));
      dune.scale.set(1.6, 0.35 + i * 0.04, 1.2);
      dune.position.set(x, islandHeight(isl, x, z) + 0.25, z);
      scene.add(dune);
    }
  }
  if (isl.biome === "reef") scene.add(makeReefDressing(isl));
  if (isl.biome === "rocks") {
    scene.add(makeLookoutDressing(isl));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const r = 3.2 + i * 0.4;
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      scene.add(boulder(x, islandHeight(isl, x, z), z, 1.1 + i * 0.15));
    }
  }
}

function makeClothesline(isl: IslandDef): THREE.Group {
  const g = new THREE.Group();
  g.name = "clothesline";
  const hx = isl.x + HOUSE_LAYOUT.home.ox - 4.5;
  const hz = isl.z + HOUSE_LAYOUT.home.oz + 3.2;
  const y = islandHeight(isl, hx, hz);
  g.userData.yard = { x: hx + 1.6, z: hz + 0.2, y };
  g.add(cylPost(hx, y, hz));
  g.add(cylPost(hx + 3.2, y, hz + 0.4));
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.25, 4), toon(0xfff6ea));
  line.position.set(hx + 1.6, y + 1.15, hz + 0.2);
  line.rotation.z = Math.PI / 2;
  line.rotation.y = 0.12;
  g.add(line);
  const colors = [0xe23a3a, 0xfff6ea, 0x7ec8e8];
  colors.forEach((c, i) => {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.55), toon(c));
    cloth.position.set(hx + 0.7 + i * 0.85, y + 0.85, hz + 0.12 + i * 0.08);
    cloth.rotation.y = 0.2;
    g.add(cloth);
  });
  const hook = new THREE.Group();
  hook.name = "yard-hook";
  hook.position.set(hx + 1.6, y + 0.2, hz + 0.2);
  g.add(hook);
  return g;
}

function makeReefDressing(isl: IslandDef): THREE.Group {
  const g = new THREE.Group();
  g.name = "whisper-reef";
  const cy = islandHeight(isl, isl.x, isl.z) + 1.15;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 1.35, 10), toon(PALETTE.stone));
  plinth.position.set(isl.x, islandHeight(isl, isl.x, isl.z) + 0.7, isl.z);
  g.add(plinth);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.45, 10), toon(PALETTE.stoneDeep));
  stone.position.set(isl.x, cy + 0.28, isl.z);
  g.add(stone);
  const conch = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), toon(0xf4efe6, { emissive: 0xffe8c4 }));
  conch.scale.set(1.15, 0.55, 0.9);
  conch.position.set(isl.x, cy + 0.62, isl.z);
  g.add(conch);
  const sign = makeSign("Listen");
  sign.scale.setScalar(0.72);
  sign.position.set(isl.x - 1.8, cy, isl.z + 1.1);
  g.add(sign);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 5.2 + (i % 2) * 1.6;
    const x = isl.x + Math.cos(a) * r;
    const z = isl.z + Math.sin(a) * r;
    const y = islandHeight(isl, x, z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55 + (i % 3) * 0.12, 8, 6), toon(i % 2 ? 0xe56b9e : 0x3ecfcf));
    head.position.set(x, y + 0.45, z);
    g.add(head);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const r = 3.4;
    const x = isl.x + Math.cos(a) * r;
    const z = isl.z + Math.sin(a) * r;
    const y = islandHeight(isl, x, z);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.05, 12), toon(0x3a90d4));
    pool.position.set(x, y + 0.08, z);
    g.add(pool);
  }
  const rib = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 0.35), toon(0xd9c4a0));
  rib.position.set(isl.x + 3.4, islandHeight(isl, isl.x + 3.4, isl.z - 1.2) + 0.35, isl.z - 1.2);
  rib.rotation.y = 0.4;
  rib.rotation.z = 0.12;
  g.add(rib);
  const rib2 = rib.clone();
  rib2.position.set(isl.x + 2.6, rib.position.y + 0.4, isl.z - 0.55);
  rib2.rotation.z = 0.4;
  g.add(rib2);
  return g;
}

function makeLookoutDressing(isl: IslandDef): THREE.Group {
  const g = new THREE.Group();
  g.name = "lookout-stack";
  const y = islandHeight(isl, isl.x, isl.z);
  const px = isl.x + 0.9;
  const pz = isl.z + 0.6;
  for (const [ox, oz] of [
    [-0.28, -0.22],
    [0.3, -0.18],
    [0.02, 0.32],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.55, 6), toon(PALETTE.woodDeep));
    leg.position.set(px + ox, y + 0.75, pz + oz);
    leg.rotation.z = ox * 0.35;
    leg.rotation.x = -oz * 0.3;
    g.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 8), toon(PALETTE.wood));
  deck.position.set(px, y + 1.42, pz);
  g.add(deck);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.05, 10), toon(0xc48a4a));
  tube.rotation.z = Math.PI / 2;
  tube.rotation.y = -0.7;
  tube.position.set(px + 0.15, y + 1.62, pz + 0.12);
  g.add(tube);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), toon(0x9fe7ff, { emissive: 0x7ec8e8 }));
  lens.rotation.y = -0.7;
  lens.position.set(px + 0.62, y + 1.62, pz + 0.42);
  g.add(lens);
  const sign = makeSign("Look");
  sign.scale.setScalar(0.62);
  sign.position.set(px - 1.15, y, pz - 0.4);
  g.add(sign);
  for (let i = 0; i < 5; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.38), toon(i % 2 ? PALETTE.wood : PALETTE.woodDeep));
    const t = i / 5;
    step.position.set(isl.x - 1.2 + t * 1.6, y - 1.8 + i * 0.42, isl.z + 2.4 - i * 0.45);
    g.add(step);
  }
  return g;
}

function cylPost(x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.35, 6), toon(PALETTE.woodDeep));
  m.position.set(x, y + 0.65, z);
  return m;
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
  const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.18), toon(PALETTE.woodDeep));
  cleat.position.set(isl.x + ux * (tip - 0.4), 0.32, isl.z + uz * (tip - 0.4));
  g.add(cleat);
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.38, 8), toon(PALETTE.wood));
  bollard.position.set(isl.x + ux * (tip - 0.4), 0.48, isl.z + uz * (tip - 0.4));
  g.add(bollard);
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
  const lichen = toon(0xc5c2b4);
  const col = new THREE.Mesh(new THREE.BoxGeometry(0.85, 4.8, 0.95), mat);
  col.position.set(-2.45, 2.4, 0);
  col.rotation.z = 0.04;
  const col2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.0, 1.0), lichen);
  col2.position.set(2.5, 2.5, 0.08);
  col2.rotation.z = -0.05;
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.82, 1.15), mat);
  top.position.set(0.05, 4.85, 0);
  top.rotation.z = -0.03;
  const capL = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.38, 1.25), lichen);
  capL.position.set(-2.45, 5.35, 0);
  const capR = capL.clone();
  capR.position.x = 2.5;
  const stub = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), mat);
  stub.position.set(4.3, 0.9, 0.4);
  stub.rotation.y = 0.4;
  g.add(col, col2, top, capL, capR, stub);
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
