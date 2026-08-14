import * as THREE from "three";
import { toon, PALETTE } from "../materials";
import { createItemVisual } from "../models/items";
import { createNpc } from "../models/animals";
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
  home: { wall: 0xf8e9b0, floor: 0xd2a36b, trim: PALETTE.roof },
  mallow: { wall: 0xffe4ef, floor: 0xf4d7c8, trim: 0xe56b9e },
  pebble: { wall: 0xd9d3c4, floor: 0x8d8778, trim: 0x5a6b4a },
  coral: { wall: 0x9be7e0, floor: 0xf2c14e, trim: 0xe23a3a },
  brine: { wall: 0xc49a6c, floor: 0x8a5a32, trim: 0x1f3a5a },
};

export function buildInterior(kind: HouseKind): InteriorRoom {
  const pal = WALLS[kind];
  const group = new THREE.Group();
  const w = 10;
  const d = 8;
  const h = 4.2;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), toon(pal.floor));
  floor.position.y = 0;
  floor.receiveShadow = true;
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

  const window = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0x9fd9ff }));
  window.position.set(-2.4, 2.3, -d / 2 + 0.1);
  group.add(window);
  const window2 = window.clone();
  window2.position.x = 2.4;
  group.add(window2);

    const lamp = new THREE.PointLight(0xffe0b0, 0.55, 16);
    lamp.position.set(0, 3.2, 0);
    group.add(lamp);
    const hemi = new THREE.HemisphereLight(0xfff1d6, 0x8a6a40, 1.1);
    group.add(hemi);
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

  if (kind === "home") {
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.04, 24), toon(0xe23a3a));
    rug.position.set(0, 0.08, 0.2);
    group.add(rug);
    const rugInner = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 24), toon(0xf2c14e));
    rugInner.position.set(0, 0.09, 0.2);
    group.add(rugInner);
    const bed = new THREE.Group();
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 2.4), toon(0xfff6ea));
    mattress.position.set(3.2, 0.35, -1.4);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.5), toon(PALETTE.skirt));
    blanket.position.set(3.2, 0.55, -1.1);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.5), toon(0x8b7cff));
    pillow.position.set(3.2, 0.62, -2.3);
    bed.add(mattress, blanket, pillow);
    group.add(bed);
    interacts.push({ kind: { type: "sleep" }, position: new THREE.Vector3(3.2, 0, -1.2), label: "Sleep until morning" });

    const shelf = new THREE.Group();
    const backboard = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.12), toon(PALETTE.woodDeep));
    backboard.position.set(0, 1.7, -d / 2 + 0.3);
    shelf.add(backboard);
    for (let row = 0; row < 3; row++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.42), toon(PALETTE.wood));
      plank.position.set(0, 0.7 + row * 0.75, -d / 2 + 0.48);
      shelf.add(plank);
      for (let col = 0; col < 4; col++) {
        const anchor = new THREE.Object3D();
        const index = row * 4 + col;
        anchor.position.set(-1.5 + col * 1.0, 0.9 + row * 0.75, -d / 2 + 0.48);
        anchor.userData.slot = index;
        shelf.add(anchor);
        shelfAnchors.push(anchor);
        interacts.push({
          kind: { type: "shelf", index },
          position: new THREE.Vector3(-1.5 + col * 1.0, 0, -d / 2 + 1.1),
          label: "Arrange a treasure",
        });
      }
    }
    group.add(shelf);
  } else {
    uniqueFurniture(kind, group);
    const npcMesh = createNpc(kind === "mallow" ? "mallow" : kind === "pebble" ? "pebble" : kind === "coral" ? "coral" : "brine");
    npcMesh.position.copy(npcAnchor);
    npcMesh.rotation.y = Math.PI;
    npcMesh.name = "interior-npc";
    group.add(npcMesh);
    const nid = kind as NpcId;
    interacts.push({ kind: { type: "npc", id: nid }, position: npcAnchor.clone(), label: `Talk to ${kind}` });
  }

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
