import * as THREE from "three";
import { ITEMS } from "../catalog";
import type { ItemDef, Rarity } from "../types";
import { iridescent, toon, glowSprite } from "../materials";
import { mulberry32 } from "../rng";

function latheShell(profile: number[][], color: number, accent: number): THREE.Group {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 18);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, toon(color));
  m.castShadow = true;
  g.add(m);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(profile[profile.length - 1][0] * 0.9, 0.03, 6, 16), toon(accent));
  lip.position.y = profile[profile.length - 1][1];
  g.add(lip);
  return g;
}

function rockBlob(seed: number, color: number, accent: number): THREE.Group {
  const rng = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(0.28, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    v.multiplyScalar(0.75 + rng() * 0.45);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, toon(color)));
  if (rng() > 0.4) {
    const fleck = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), toon(accent));
    fleck.position.set((rng() - 0.5) * 0.2, 0.12, (rng() - 0.5) * 0.2);
    g.add(fleck);
  }
  return g;
}

function crystal(color: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + i * 0.02, 0), iridescent(color));
    m.position.set((i - 2) * 0.08, 0.1 + (i % 2) * 0.08, (i % 3) * 0.05);
    m.rotation.set(0.2 * i, 0.4 * i, 0);
    g.add(m);
  }
  return g;
}

export function createItemVisual(id: string): THREE.Group {
  const def = ITEMS[id];
  const g = new THREE.Group();
  g.name = id;
  if (!def) return g;

  if (def.kind === "shell") {
    g.add(shellFor(def));
  } else if (def.kind === "rock") {
    g.add(rockFor(def));
  } else {
    g.add(decorFor(def));
  }
  return g;
}

function shellFor(def: ItemDef): THREE.Object3D {
  switch (def.id) {
    case "white_cockle":
    case "sunset_scallop": {
      const sh = new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI);
      const m = new THREE.Mesh(sh, def.id === "sunset_scallop" ? iridescent(def.color) : toon(def.color));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(1.1, 0.45, 1);
      const g = new THREE.Group();
      g.add(m);
      return g;
    }
    case "tiny_cowrie": {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), toon(def.color));
      m.scale.set(1.2, 0.7, 0.9);
      return m;
    }
    case "star_sand_dollar": {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 5), toon(def.color));
      return m;
    }
    case "heart_conch": {
      const g = new THREE.Group();
      const body = latheShell(
        [
          [0.02, 0],
          [0.18, 0.1],
          [0.22, 0.28],
          [0.12, 0.48],
          [0.04, 0.62],
        ],
        def.color,
        def.accent ?? def.color,
      );
      g.add(body);
      return g;
    }
    case "prismatic_spiral":
    case "moon_nautilus":
    case "spiral_turban":
    case "candy_conch":
    case "striped_whelk":
      return latheShell(
        [
          [0.02, 0],
          [0.16, 0.08],
          [0.2, 0.22],
          [0.14, 0.4],
          [0.05, 0.55],
        ],
        def.color,
        def.accent ?? 0xffffff,
      );
    case "rainbow_abalone": {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI), iridescent(def.color));
      m.rotation.x = -0.6;
      m.scale.set(1.2, 0.4, 1);
      return m;
    }
    case "pearl_mussel": {
      const g = new THREE.Group();
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI), toon(def.color));
      a.rotation.x = -1.2;
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), toon(0xf4f0ea));
      pearl.position.y = 0.06;
      g.add(a, pearl);
      return g;
    }
    default:
      return latheShell(
        [
          [0.04, 0],
          [0.18, 0.1],
          [0.14, 0.3],
        ],
        def.color,
        def.accent ?? def.color,
      );
  }
}

function rockFor(def: ItemDef): THREE.Object3D {
  if (def.id === "tide_crystal" || def.id === "wind_tear" || def.id === "dawn_opal") {
    return crystal(def.color);
  }
  if (def.id === "starstone") {
    const g = rockBlob(99, def.color, def.accent ?? 0xffffff);
    g.add(glowSprite(def.glow ?? def.color, 1.1));
    return g;
  }
  if (def.id === "ember_geode") {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI), toon(def.color));
    shell.rotation.x = Math.PI / 2;
    const inner = crystal(def.accent ?? 0xff7a3a);
    inner.scale.setScalar(0.7);
    inner.position.y = 0.05;
    g.add(shell, inner);
    return g;
  }
  if (def.id === "beach_glass" || def.id === "amber_droplet") {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshPhysicalMaterial({
        color: def.color,
        roughness: 0.15,
        transmission: 0.55,
        thickness: 0.4,
        transparent: true,
      }),
    );
    m.scale.set(1, 0.7, 1.1);
    return m;
  }
  return rockBlob(def.id.length * 17, def.color, def.accent ?? 0xffffff);
}

function decorFor(def: ItemDef): THREE.Object3D {
  const g = new THREE.Group();
  if (def.id.includes("lantern")) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8), toon(0x8a5a32));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(def.color, { emissive: def.color }));
    lamp.position.y = 0.28;
    g.add(post, lamp);
  } else if (def.id === "tropical_rug") {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), toon(def.color)));
  } else if (def.id === "knitted_cushion") {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(def.color));
    c.scale.set(1.2, 0.5, 1.1);
    g.add(c);
  } else if (def.id === "geology_book" || def.id === "sea_chart") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.48), toon(def.color));
    g.add(b);
  } else if (def.id === "potted_clover") {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.16, 10), toon(0xc48a4a));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon(def.color));
    leaf.position.y = 0.18;
    g.add(pot, leaf);
  } else if (def.id === "hanging_mobile") {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), toon([0x7ec8e8, 0xffb3c7, 0xf2c14e, 0x7bc47a][i]));
      s.position.set(Math.sin(i) * 0.2, -i * 0.12, Math.cos(i) * 0.2);
      g.add(s);
    }
  } else if (def.id === "flower_stool") {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.12, 10), toon(def.color));
    g.add(seat);
  } else if (def.id === "tea_set") {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.1, 10), toon(def.color));
    g.add(cup);
  } else if (def.id === "knitted_blanket" || def.id === "heart_pillow") {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), toon(def.color));
    c.scale.set(1.35, 0.28, 1.1);
    g.add(c);
  } else if (def.id === "specimen_jar") {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 10), toon(def.color));
    g.add(jar);
  } else if (def.id === "stall_banner") {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), toon(def.color));
    g.add(b);
  } else if (def.id === "helm_wheel") {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 14), toon(def.color)));
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), toon(def.color)));
  }
  return g;
}

export const AURA_SCALE: Record<Rarity, number> = {
  common: 0.55,
  uncommon: 0.85,
  rare: 1.25,
  legendary: 1.7,
};

export function createAura(def: ItemDef): THREE.Group {
  const g = new THREE.Group();
  g.name = "aura";
  const col = def.glow ?? def.color;
  g.add(glowSprite(col, AURA_SCALE[def.rarity] * 0.72));
  if (def.rarity === "legendary") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.02, 6, 18),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    ring.name = "spin";
    g.add(ring);
  }
  return g;
}
