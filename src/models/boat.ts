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

function hullShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 3.45);
  s.bezierCurveTo(0.38, 3.15, 0.95, 2.15, 1.18, 0.95);
  s.lineTo(1.22, -0.45);
  s.lineTo(1.12, -2.15);
  s.bezierCurveTo(0.98, -2.85, 0.48, -3.18, 0, -3.22);
  s.bezierCurveTo(-0.48, -3.18, -0.98, -2.85, -1.12, -2.15);
  s.lineTo(-1.22, -0.45);
  s.lineTo(-1.18, 0.95);
  s.bezierCurveTo(-0.95, 2.15, -0.38, 3.15, 0, 3.45);
  return s;
}

export class RedBoat {
  group = new THREE.Group();
  sail: THREE.Mesh;
  boom: THREE.Mesh;
  vane: THREE.Group;
  wake: THREE.Points;
  private sailRest: Float32Array;

  constructor() {
    const hullGeo = new THREE.ExtrudeGeometry(hullShape(), {
      depth: 0.92,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    hullGeo.rotateX(-Math.PI / 2);
    hullGeo.rotateY(Math.PI);
    hullGeo.translate(0, 0.1, 0);
    hullGeo.computeVertexNormals();
    const hull = new THREE.Mesh(hullGeo, toon(PALETTE.boatRed));
    hull.castShadow = true;
    this.group.add(hull);
    this.group.add(outlineClone(hull, 0.04));

    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.07, 4.15), toon(PALETTE.wood));
    deck.position.set(0, 0.88, -0.2);
    this.group.add(deck);

    const well = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.18, 1.65), toon(0x6b3a22));
    well.position.set(0, 0.94, 0.55);
    this.group.add(well);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.14, 0.36), toon(PALETTE.woodDeep));
    bench.position.set(0, 1.05, 0.12);
    this.group.add(bench);

    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 0.1), toon(PALETTE.boatRed));
    bulkhead.position.set(0, 1.16, -0.45);
    this.group.add(bulkhead);

    const transom = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 0.14), toon(PALETTE.boatRed));
    transom.position.set(0, 0.62, -3.12);
    this.group.add(transom);

    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.42), toon(PALETTE.boatRed));
    stem.position.set(0, 0.72, 3.28);
    this.group.add(stem);

    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 4.4), toon(0x8a1a1a));
    keel.position.set(0, -0.04, -0.15);
    this.group.add(keel);

    for (const x of [-1.08, 1.08]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 4.55), toon(0xfff6ea));
      rail.position.set(x, 1.04, -0.15);
      this.group.add(rail);
    }
    const sternRail = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.18, 0.08), toon(0xfff6ea));
    sternRail.position.set(0, 1.04, -3.08);
    this.group.add(sternRail);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 4.05, 8), toon(PALETTE.woodDeep));
    mast.position.set(0, 2.85, -1.55);
    this.group.add(mast);

    const sailGeo = new THREE.PlaneGeometry(1.95, 2.65, 12, 12);
    this.sailRest = new Float32Array(sailGeo.attributes.position.array as Float32Array);
    this.sail = new THREE.Mesh(
      sailGeo,
      new THREE.MeshLambertMaterial({ color: PALETTE.sail, side: THREE.DoubleSide }),
    );
    this.sail.position.set(0.88, 2.55, -1.22);
    this.sail.rotation.y = 0.28;
    this.group.add(this.sail);

    this.boom = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.95, 6), toon(PALETTE.wood));
    this.boom.rotation.x = Math.PI / 2;
    this.boom.position.set(0.52, 1.35, -1.12);
    this.group.add(this.boom);

    const gaff = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.45, 6), toon(PALETTE.wood));
    gaff.rotation.x = Math.PI / 2;
    gaff.position.set(0.42, 3.72, -1.32);
    this.group.add(gaff);

    const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.82, 6), toon(PALETTE.woodDeep));
    tiller.rotation.x = Math.PI / 2;
    tiller.position.set(0, 1.08, -2.25);
    this.group.add(tiller);

    this.vane = new THREE.Group();
    this.vane.position.set(0, 4.88, -1.55);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), toon(0xf2c14e));
    stick.position.y = 0.14;
    this.vane.add(stick);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), toon(0xe23a3a, { side: THREE.DoubleSide }));
    flag.position.set(0.16, 0.24, 0);
    this.vane.add(flag);
    this.group.add(this.vane);

    const emblem = new THREE.Group();
    emblem.position.set(0, 0.72, 3.22);
    const hg = new THREE.ExtrudeGeometry(heartShape(0.2), { depth: 0.06, bevelEnabled: false });
    hg.center();
    const heart = new THREE.Mesh(hg, toon(0xe23a3a));
    emblem.add(heart);
    this.group.add(emblem);

    const geo = new THREE.BufferGeometry();
    const n = 48;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.wake = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.5 }),
    );
    this.wake.position.set(0, 0.04, -3.15);
    this.group.add(this.wake);
  }

  update(t: number, speed: number, sailAmt = 0.2, windYaw = 0, boatYaw = 0, polar = 0.4) {
    const rel = windYaw - boatYaw;
    const fill = THREE.MathUtils.clamp(sailAmt * polar, 0, 1);
    const luff = polar < 0.18 ? Math.sin(t * 16) * 0.14 : 0;
    const boomYaw = THREE.MathUtils.clamp(Math.sin(rel) * 0.55, -0.7, 0.7) * Math.max(0.25, sailAmt);
    this.sail.rotation.y = 0.28 + boomYaw + luff;
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
