import * as THREE from "three";
import { PALETTE, toon, outlineClone } from "../materials";

function heartShape(s = 1): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, s * 0.35);
  sh.bezierCurveTo(-s * 0.15, s * 0.7, -s * 0.7, s * 0.55, -s * 0.7, s * 0.1);
  sh.bezierCurveTo(-s * 0.7, -s * 0.25, 0, -s * 0.55, 0, -s * 0.85);
  sh.bezierCurveTo(0, -s * 0.55, s * 0.7, -s * 0.25, s * 0.7, s * 0.1);
  sh.bezierCurveTo(s * 0.7, s * 0.55, s * 0.15, s * 0.7, 0, s * 0.35);
  return sh;
}

export class RedBoat {
  group = new THREE.Group();
  sail: THREE.Mesh;
  boom: THREE.Mesh;
  vane: THREE.Group;
  wake: THREE.Points;
  private sailRest: Float32Array;

  constructor() {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 2.45), toon(PALETTE.boatRed));
    hull.position.y = 0.22;
    hull.castShadow = true;
    this.group.add(hull);
    this.group.add(outlineClone(hull, 0.04));

    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.1, 8), toon(PALETTE.boatRed));
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.22, 1.52);
    bow.scale.set(0.78, 1, 0.62);
    this.group.add(bow);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 2.0), toon(PALETTE.wood));
    deck.position.y = 0.56;
    this.group.add(deck);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.07, 2.5), toon(0xfff6ea));
    rail.position.y = 0.58;
    this.group.add(rail);
    const railCut = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 2.2), toon(PALETTE.wood));
    railCut.position.y = 0.6;
    this.group.add(railCut);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.45, 8), toon(PALETTE.woodDeep));
    mast.position.set(0, 1.55, -0.15);
    this.group.add(mast);

    const sailGeo = new THREE.PlaneGeometry(1.7, 1.85, 12, 12);
    this.sailRest = new Float32Array(sailGeo.attributes.position.array as Float32Array);
    this.sail = new THREE.Mesh(
      sailGeo,
      new THREE.MeshLambertMaterial({ color: PALETTE.sail, side: THREE.DoubleSide }),
    );
    this.sail.position.set(0.12, 1.55, 0.15);
    this.sail.rotation.y = 0.35;
    this.group.add(this.sail);

    this.boom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.55, 6), toon(PALETTE.wood));
    this.boom.rotation.x = Math.PI / 2;
    this.boom.position.set(0.05, 0.68, 0.35);
    this.group.add(this.boom);

    this.vane = new THREE.Group();
    this.vane.position.set(0, 2.82, -0.15);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), toon(0xf2c14e));
    stick.position.y = 0.14;
    this.vane.add(stick);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), toon(0xe23a3a, { side: THREE.DoubleSide }));
    flag.position.set(0.14, 0.22, 0);
    this.vane.add(flag);
    this.group.add(this.vane);

    const emblem = new THREE.Group();
    emblem.position.set(0, 0.55, 2.05);
    const hg = new THREE.ExtrudeGeometry(heartShape(0.22), { depth: 0.07, bevelEnabled: false });
    hg.center();
    const heart = new THREE.Mesh(hg, toon(0xe23a3a));
    emblem.add(heart);
    [0xff8ba7, 0x7bc47a, 0x7ec8e8].forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), toon(col));
      f.scale.set(0.4, 1.6, 0.22);
      f.position.set((i - 1) * 0.13, 0.2, 0.02);
      f.rotation.z = (i - 1) * 0.45;
      emblem.add(f);
    });
    this.group.add(emblem);

    const geo = new THREE.BufferGeometry();
    const n = 40;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.wake = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.55 }),
    );
    this.wake.position.set(0, 0.05, -1.4);
    this.group.add(this.wake);
  }

  update(t: number, speed: number, sailAmt = 0.2, windYaw = 0, boatYaw = 0, polar = 0.4) {
    const rel = windYaw - boatYaw;
    const fill = THREE.MathUtils.clamp(sailAmt * polar, 0, 1);
    const luff = polar < 0.18 ? Math.sin(t * 16) * 0.14 : 0;
    const boomYaw = THREE.MathUtils.clamp(Math.sin(rel) * 0.72, -0.85, 0.85) * Math.max(0.25, sailAmt);
    this.sail.rotation.y = 0.12 + boomYaw + luff;
    this.boom.rotation.y = boomYaw * 0.85;
    this.boom.rotation.z = 0.08;
    this.vane.rotation.y = rel;
    this.vane.children[1].scale.x = 0.85 + Math.sin(t * 9) * 0.12;

    const pos = this.sail.geometry.attributes.position;
    const belly = 0.08 + fill * 0.28;
    for (let i = 0; i < pos.count; i++) {
      const x = this.sailRest[i * 3];
      const y = this.sailRest[i * 3 + 1];
      const wave = polar < 0.18 ? Math.sin(t * 22 + y * 6) * 0.07 * sailAmt : 0;
      pos.setXYZ(i, x, y, Math.sin((x + 0.9) * 1.15) * belly + y * 0.02 + wave);
    }
    pos.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();
    this.sail.scale.set(0.72 + sailAmt * 0.32, 0.55 + sailAmt * 0.45, 1);

    const wake = this.wake.geometry.attributes.position;
    for (let i = 0; i < wake.count; i++) {
      wake.setXYZ(i, (i % 2 === 0 ? -0.22 : 0.22) * (speed > 0.2 ? 1 : 0.2), Math.sin(t * 4 + i) * 0.04, -i * 0.08);
    }
    wake.needsUpdate = true;
    (this.wake.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp(speed * 0.4, 0.12, 0.7);
  }
}
