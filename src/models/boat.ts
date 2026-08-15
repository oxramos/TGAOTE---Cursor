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
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.72, 3.85), toon(PALETTE.boatRed));
    hull.position.set(0, 0.22, -0.18);
    hull.castShadow = true;
    this.group.add(hull);
    this.group.add(outlineClone(hull, 0.045));

    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.08, 1.85, 10), toon(PALETTE.boatRed));
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.28, 2.28);
    bow.scale.set(0.95, 1, 0.72);
    this.group.add(bow);
    this.group.add(outlineClone(bow, 0.04));

    const transom = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.78, 0.2), toon(PALETTE.boatRed));
    transom.position.set(0, 0.34, -2.12);
    this.group.add(transom);

    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 3.45), toon(0x8a1a1a));
    keel.position.set(0, -0.12, -0.15);
    this.group.add(keel);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 2.55), toon(PALETTE.wood));
    deck.position.set(0, 0.58, -0.45);
    this.group.add(deck);

    const well = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.14, 1.35), toon(0x6b3a22));
    well.position.set(0, 0.62, 0.72);
    this.group.add(well);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.32), toon(PALETTE.woodDeep));
    bench.position.set(0, 0.72, 0.28);
    this.group.add(bench);

    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 0.1), toon(PALETTE.boatRed));
    bulkhead.position.set(0, 0.85, -0.12);
    this.group.add(bulkhead);

    for (const x of [-0.98, 0.98]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 3.65), toon(0xfff6ea));
      rail.position.set(x, 0.7, -0.12);
      this.group.add(rail);
    }
    const sternRail = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.1), toon(0xfff6ea));
    sternRail.position.set(0, 0.72, -2.08);
    this.group.add(sternRail);

    const bowRail = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 6, 12, Math.PI));
    bowRail.material = toon(0xfff6ea);
    bowRail.rotation.x = Math.PI / 2;
    bowRail.position.set(0, 0.74, 1.95);
    this.group.add(bowRail);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.45, 8), toon(PALETTE.woodDeep));
    mast.position.set(0, 2.28, -1.15);
    this.group.add(mast);

    const sailGeo = new THREE.PlaneGeometry(1.95, 2.45, 12, 12);
    this.sailRest = new Float32Array(sailGeo.attributes.position.array as Float32Array);
    this.sail = new THREE.Mesh(
      sailGeo,
      new THREE.MeshLambertMaterial({ color: PALETTE.sail, side: THREE.DoubleSide }),
    );
    this.sail.position.set(0.92, 2.18, -0.85);
    this.sail.rotation.y = 0.22;
    this.group.add(this.sail);

    this.boom = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.95, 6), toon(PALETTE.wood));
    this.boom.rotation.x = Math.PI / 2;
    this.boom.position.set(0.55, 1.18, -0.72);
    this.group.add(this.boom);

    const gaff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.45, 6), toon(PALETTE.wood));
    gaff.rotation.x = Math.PI / 2;
    gaff.position.set(0.42, 3.22, -0.92);
    this.group.add(gaff);

    const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), toon(PALETTE.woodDeep));
    tiller.rotation.x = Math.PI / 2;
    tiller.position.set(0, 0.82, -1.55);
    this.group.add(tiller);

    this.vane = new THREE.Group();
    this.vane.position.set(0, 4.02, -1.15);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), toon(0xf2c14e));
    stick.position.y = 0.14;
    this.vane.add(stick);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), toon(0xe23a3a, { side: THREE.DoubleSide }));
    flag.position.set(0.16, 0.24, 0);
    this.vane.add(flag);
    this.group.add(this.vane);

    const emblem = new THREE.Group();
    emblem.position.set(0, 0.62, 2.85);
    const hg = new THREE.ExtrudeGeometry(heartShape(0.24), { depth: 0.07, bevelEnabled: false });
    hg.center();
    const heart = new THREE.Mesh(hg, toon(0xe23a3a));
    emblem.add(heart);
    [0xff8ba7, 0x7bc47a, 0x7ec8e8].forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), toon(col));
      f.scale.set(0.4, 1.6, 0.22);
      f.position.set((i - 1) * 0.13, 0.22, 0.02);
      f.rotation.z = (i - 1) * 0.45;
      emblem.add(f);
    });
    this.group.add(emblem);

    const geo = new THREE.BufferGeometry();
    const n = 48;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.wake = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.5 }),
    );
    this.wake.position.set(0, 0.04, -2.25);
    this.group.add(this.wake);
  }

  update(t: number, speed: number, sailAmt = 0.2, windYaw = 0, boatYaw = 0, polar = 0.4) {
    const rel = windYaw - boatYaw;
    const fill = THREE.MathUtils.clamp(sailAmt * polar, 0, 1);
    const luff = polar < 0.18 ? Math.sin(t * 16) * 0.14 : 0;
    const boomYaw = THREE.MathUtils.clamp(Math.sin(rel) * 0.55, -0.7, 0.7) * Math.max(0.25, sailAmt);
    this.sail.rotation.y = 0.22 + boomYaw + luff;
    this.boom.rotation.y = boomYaw * 0.85;
    this.boom.rotation.z = 0.04;
    this.vane.rotation.y = rel;
    this.vane.children[1].scale.x = 0.85 + Math.sin(t * 9) * 0.12;

    const pos = this.sail.geometry.attributes.position;
    const belly = 0.08 + fill * 0.32;
    for (let i = 0; i < pos.count; i++) {
      const x = this.sailRest[i * 3];
      const y = this.sailRest[i * 3 + 1];
      const wave = polar < 0.18 ? Math.sin(t * 22 + y * 6) * 0.07 * sailAmt : 0;
      pos.setXYZ(i, x, y, Math.sin((x + 0.9) * 1.15) * belly + y * 0.02 + wave);
    }
    pos.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();
    this.sail.scale.set(0.92 + sailAmt * 0.12, 0.92 + sailAmt * 0.1, 1);

    const wake = this.wake.geometry.attributes.position;
    for (let i = 0; i < wake.count; i++) {
      wake.setXYZ(i, (i % 2 === 0 ? -0.28 : 0.28) * (speed > 0.2 ? 1 : 0.2), Math.sin(t * 4 + i) * 0.04, -i * 0.09);
    }
    wake.needsUpdate = true;
    (this.wake.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp(speed * 0.35, 0.1, 0.62);
  }
}
