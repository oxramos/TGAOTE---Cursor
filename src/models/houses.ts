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

function gableRoof(w: number, d: number, h: number, color: number): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, toon(color));
  m.castShadow = true;
  return m;
}

function homeCottage(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 3.6), toon(PALETTE.cottage));
  base.position.y = 1.1;
  base.castShadow = true;
  g.add(base, outlineClone(base, 0.02));
  const upper = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.5, 3.0), toon(PALETTE.cottage));
  upper.position.y = 2.85;
  g.add(upper);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 3.7), toon(PALETTE.roof));
  trim.position.y = 2.2;
  g.add(trim);
  const roof = gableRoof(4.8, 3.4, 1.6, PALETTE.roof);
  roof.position.y = 3.55;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.45, 0.1), toon(PALETTE.roof));
  door.position.set(0, 0.78, 1.86);
  g.add(door);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.7), toon(PALETTE.roof));
  awning.position.set(0, 1.62, 2.05);
  g.add(awning);
  windowPane(g, -1.3, 1.35, 1.84);
  windowPane(g, 1.3, 1.35, 1.84);
  windowPane(g, -0.7, 2.9, 1.54);
  windowPane(g, 0.7, 2.9, 1.54);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.4), toon(PALETTE.stone));
  chimney.position.set(1.4, 4.3, -0.4);
  g.add(chimney);
  return g;
}

function windowPane(g: THREE.Group, x: number, y: number, z: number) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), toon(PALETTE.roof));
  frame.position.set(x, y, z);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), toon(0xf7c4d4));
  glass.position.set(x, y, z + 0.05);
  g.add(frame, glass);
}

function woolCottage(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.1, 18, 14), toon(0xfff0e8));
  body.position.y = 1.7;
  body.scale.set(1.15, 0.9, 1);
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.03));
  for (let i = 0; i < 10; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toon(0xfff6ea));
    const a = (i / 10) * Math.PI * 2;
    puff.position.set(Math.cos(a) * 1.8, 1.6 + (i % 3) * 0.35, Math.sin(a) * 1.5);
    g.add(puff);
  }
  const roof = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), toon(0xf4c6d7));
  roof.position.y = 3.3;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), toon(0xe56b9e));
  door.position.set(0, 0.7, 2.05);
  g.add(door);
  const yarn = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon(0x7ec8e8));
  yarn.position.set(1.6, 0.35, 1.4);
  g.add(yarn);
  return g;
}

function stoneLibrary(): THREE.Group {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.85, 5.2, 10), toon(PALETTE.stone));
  tower.position.y = 2.6;
  tower.castShadow = true;
  g.add(tower, outlineClone(tower, 0.02));
  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), toon(PALETTE.grassDeep));
  moss.position.set(1.1, 1.2, 0.8);
  moss.scale.set(1.4, 0.5, 1);
  g.add(moss);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.6, 10), toon(0x5a6b4a));
  roof.position.y = 6.0;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.5, 0.12), toon(PALETTE.woodDeep));
  door.position.set(0, 0.8, 1.75);
  g.add(door);
  for (const y of [2.4, 3.8]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), toon(0xfff1c2));
    w.position.set(0.9, y, 1.55);
    g.add(w);
  }
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), toon(0x6fbf8a));
  book.position.set(-1.4, 0.4, 1.3);
  g.add(book);
  return g;
}

function stiltShop(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.3, 1.3]) {
    for (const z of [-1.0, 1.0]) {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), toon(PALETTE.woodDeep));
      stilt.position.set(x, 0.8, z);
      g.add(stilt);
    }
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 3.0), toon(PALETTE.wood));
  floor.position.y = 1.6;
  g.add(floor);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 2.8), toon(0x3ecfcf));
  wall.position.y = 2.7;
  wall.castShadow = true;
  g.add(wall);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 1.4), toon(0xe23a3a));
  awning.position.set(0, 3.5, 1.4);
  awning.rotation.x = -0.35;
  g.add(awning);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 1.4), toon(0xf2c14e));
  stripe.position.set(0, 3.42, 1.4);
  stripe.rotation.x = -0.35;
  g.add(stripe);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.08), toon(0xf2c14e));
  door.position.set(0, 2.3, 1.45);
  g.add(door);
  return g;
}

function boatHouse(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 3.2), toon(PALETTE.wood));
  base.position.y = 1.4;
  base.castShadow = true;
  g.add(base, outlineClone(base, 0.02));
  const roof = gableRoof(4.6, 3.4, 1.4, 0x1f3a5a);
  roof.position.y = 2.4;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.1), toon(PALETTE.woodDeep));
  door.position.set(0, 0.9, 1.65);
  g.add(door);
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.1, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xdde8f0, wireframe: true, transparent: true, opacity: 0.7 }),
  );
  net.position.set(1.6, 1.2, 1.7);
  g.add(net);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0xffd36a, { emissive: 0xffd36a }));
  lantern.position.set(-1.5, 2.4, 1.5);
  g.add(lantern);
  return g;
}
