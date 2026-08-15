import * as THREE from "three";
import { ITEMS, ISLANDS } from "../catalog";
import { createAura, createItemVisual } from "../models/items";
import { heightAt } from "./islands";
import { mulberry32 } from "../rng";
import type { ItemDef } from "../types";

export type Pickup = {
  id: string;
  item: string;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  taken: boolean;
};

const FIXED: { id: string; item: string; x: number; z: number }[] = [
  { id: "intro-cockle", item: "white_cockle", x: 11.5, z: 14.2 },
  { id: "leg-heart", item: "heart_conch", x: 16, z: 166 },
  { id: "leg-prism", item: "prismatic_spiral", x: -162, z: -22 },
  { id: "leg-opal", item: "dawn_opal", x: 148, z: 58 },
  { id: "leg-tear", item: "wind_tear", x: 58, z: 108 },
  { id: "rare-moon", item: "moon_nautilus", x: -62, z: -118 },
  { id: "rare-star", item: "starstone", x: 118, z: 62 },
  { id: "rare-abalone", item: "rainbow_abalone", x: 100, z: -92 },
  { id: "rare-geode", item: "ember_geode", x: 145, z: 78 },
  { id: "rare-sand", item: "star_sand_dollar", x: 108, z: -118 },
  { id: "rare-tide", item: "tide_crystal", x: -160, z: -22 },
  { id: "unc-sunset", item: "sunset_scallop", x: 14, z: 6 },
  { id: "unc-pearl", item: "pearl_mussel", x: -60, z: -118 },
  { id: "unc-candy", item: "candy_conch", x: -110, z: 70 },
  { id: "unc-turban", item: "spiral_turban", x: 108, z: -96 },
  { id: "unc-quartz", item: "rose_quartz", x: 4, z: -6 },
  { id: "unc-amber", item: "amber_droplet", x: -118, z: 68 },
  { id: "unc-granite", item: "sea_granite", x: -164, z: -32 },
];

const COMMONS = [
  "white_cockle",
  "striped_whelk",
  "tiny_cowrie",
  "blue_limpet",
  "smooth_pebble",
  "beach_glass",
  "striped_agate",
  "basalt_bead",
];

export class CollectibleWorld {
  pickups: Pickup[] = [];
  group = new THREE.Group();

  spawn(collected: string[], day: number) {
    this.group.clear();
    this.pickups = [];
    for (const f of FIXED) {
      if (collected.includes(f.id)) continue;
      this.addPickup(f.id, f.item, f.x, f.z);
    }
    const rng = mulberry32(day * 999 + 7);
    for (const isl of ISLANDS) {
      const n = isl.id === "reef" ? 2 : 7;
      for (let i = 0; i < n; i++) {
        const id = `d${day}-${isl.id}-${i}`;
        if (collected.includes(id)) continue;
        const a = rng() * Math.PI * 2;
        const r = (0.55 + rng() * 0.4) * isl.radius;
        const x = isl.x + Math.cos(a) * r;
        const z = isl.z + Math.sin(a) * r;
        const item = COMMONS[Math.floor(rng() * COMMONS.length)];
        this.addPickup(id, item, x, z);
      }
    }
  }

  private addPickup(id: string, item: string, x: number, z: number) {
    const def = ITEMS[item];
    if (!def) return;
    const y = Math.max(heightAt(x, z), 0.12) + 0.25;
    const mesh = new THREE.Group();
    const vis = createItemVisual(item);
    vis.scale.setScalar(def.rarity === "legendary" ? 1.35 : id === "intro-cockle" ? 1.2 : 1);
    mesh.add(vis);
    const aura = createAura(id === "intro-cockle" ? { ...def, rarity: "uncommon", glow: 0xfff1a8 } : def);
    mesh.add(aura);
    mesh.position.set(x, y, z);
    mesh.userData = { pickupId: id, item };
    this.group.add(mesh);
    this.pickups.push({ id, item, mesh, x, y, z, taken: false });
  }

  update(t: number) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      const def = ITEMS[p.item];
      const bob = 0.08 + (def.rarity === "legendary" ? 0.12 : 0.04);
      p.mesh.position.y = p.y + Math.sin(t * 2 + p.x) * bob;
      p.mesh.rotation.y = t * (def.rarity === "common" ? 0.4 : 0.9);
      p.mesh.traverse((o) => {
        if (o.name === "spin") o.rotation.z = t * 1.4;
        const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
        if (mat && mat.uniforms?.uTime) mat.uniforms.uTime.value = t;
      });
    }
  }

  nearest(x: number, z: number, max = 2.4): Pickup | null {
    let best: Pickup | null = null;
    let bd = max;
    for (const p of this.pickups) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  take(p: Pickup) {
    p.taken = true;
  }

  addExtra(id: string, item: string, x: number, z: number) {
    if (this.pickups.some((p) => p.id === id)) return;
    this.addPickup(id, item, x, z);
  }
}
