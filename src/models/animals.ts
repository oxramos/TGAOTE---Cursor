import * as THREE from "three";
import { toon, outlineClone } from "../materials";
import type { NpcId } from "../types";
import { NPCS } from "../catalog";

export function createNpc(id: NpcId): THREE.Group {
  const def = NPCS[id];
  const g = new THREE.Group();
  g.name = id;
  if (id === "mallow") g.add(makeSheep(def.color, def.accent));
  if (id === "pebble") g.add(makeFrog(def.color, def.accent));
  if (id === "coral") g.add(makeParrot(def.color, def.accent));
  if (id === "brine") g.add(makeOtter(def.color, def.accent));
  return g;
}

function makeSheep(color: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), toon(color));
  body.scale.set(1.15, 0.9, 0.95);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.06));
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), toon(color));
    const a = (i / 8) * Math.PI * 2;
    puff.position.set(Math.cos(a) * 0.42, 0.62 + (i % 2) * 0.12, Math.sin(a) * 0.32);
    g.add(puff);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(0xf0d8c0));
  head.position.set(0, 0.7, 0.48);
  g.add(head);
  const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), toon(accent));
  blush.position.set(-0.12, 0.66, 0.72);
  const blush2 = blush.clone();
  blush2.position.x *= -1;
  g.add(blush, blush2);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), toon(0xe8a0b8));
  nose.position.set(0, 0.62, 0.74);
  g.add(nose);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2a1a12 }));
  eye.position.set(-0.09, 0.76, 0.7);
  const eye2 = eye.clone();
  eye2.position.x *= -1;
  g.add(eye, eye2);
  for (const x of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 8), toon(0xf0d8c0));
    leg.position.set(x, 0.18, 0.1);
    g.add(leg);
  }
  return g;
}

function makeFrog(color: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), toon(color));
  body.scale.set(1.1, 0.85, 1);
  body.position.y = 0.38;
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.07));
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toon(0xe8f6d8));
  belly.position.set(0, 0.3, 0.2);
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), toon(color));
  head.position.set(0, 0.62, 0.18);
  g.add(head);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0xf8fff4));
  eyeL.position.set(-0.14, 0.82, 0.28);
  const eyeR = eyeL.clone();
  eyeR.position.x *= -1;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2a1a12 }));
  pupil.position.set(-0.14, 0.84, 0.38);
  const pupilR = pupil.clone();
  pupilR.position.x *= -1;
  g.add(eyeL, eyeR, pupil, pupilR);
  const glasses = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 12), toon(0xf2c14e));
  glasses.position.set(-0.14, 0.82, 0.36);
  const glassesR = glasses.clone();
  glassesR.position.x *= -1;
  g.add(glasses, glassesR);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.22), toon(accent));
  book.position.set(0.28, 0.32, 0.2);
  g.add(book);
  return g;
}

function makeParrot(color: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), toon(color));
  body.scale.set(0.85, 1.15, 0.8);
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.07));
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), toon(accent));
  belly.position.set(0, 0.42, 0.16);
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), toon(0x3ecfcf));
  head.position.set(0, 0.88, 0.06);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 8), toon(0xff8a3d));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.84, 0.28);
  g.add(beak);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), toon(color));
  crest.position.set(0, 1.12, 0);
  g.add(crest);
  const wing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), toon(0x7b6cff));
  wing.scale.set(0.4, 1.1, 0.7);
  wing.position.set(-0.28, 0.52, 0);
  const wingR = wing.clone();
  wingR.position.x *= -1;
  g.add(wing, wingR);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), toon(0x8a5a32));
  stand.position.y = 0.12;
  g.add(stand);
  return g;
}

function makeOtter(color: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), toon(color));
  body.scale.set(0.85, 1.05, 1.15);
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body, outlineClone(body, 0.06));
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toon(0xf0d8c0));
  belly.position.set(0, 0.42, 0.22);
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), toon(color));
  head.position.set(0, 0.92, 0.16);
  g.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), toon(0xf0d8c0));
  muzzle.position.set(0, 0.84, 0.36);
  g.add(muzzle);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.16, 12), toon(0x1f3a5a));
  hat.position.set(0, 1.16, 0.12);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), toon(0x1f3a5a));
  brim.position.set(0, 1.08, 0.12);
  g.add(hat, brim);
  const whisk = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.01), toon(0x2a1a12));
  whisk.position.set(0, 0.84, 0.38);
  g.add(whisk);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(accent));
  tail.scale.set(0.7, 0.5, 1.6);
  tail.position.set(0, 0.28, -0.42);
  g.add(tail);
  return g;
}
