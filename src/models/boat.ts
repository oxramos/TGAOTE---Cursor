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
  wake: THREE.Points;

  constructor() {
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.3, 0);
    hullShape.lineTo(-1.15, 0.55);
    hullShape.lineTo(1.05, 0.5);
    hullShape.lineTo(1.35, 0.15);
    hullShape.lineTo(1.15, 0);
    hullShape.lineTo(-1.3, 0);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 });
    hullGeo.center();
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.rotateY(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, toon(PALETTE.boatRed));
    hull.castShadow = true;
    hull.scale.set(1.15, 0.85, 1);
    hull.position.y = 0.18;
    this.group.add(hull);
    this.group.add(outlineClone(hull, 0.04));

    const trim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.045, 6, 24), toon(0xfff6ea));
    trim.rotation.x = Math.PI / 2;
    trim.scale.set(1.35, 0.55, 1);
    trim.position.y = 0.42;
    this.group.add(trim);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.95), toon(PALETTE.wood));
    deck.position.y = 0.38;
    this.group.add(deck);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.3, 8), toon(PALETTE.woodDeep));
    mast.position.set(0.15, 1.4, 0);
    this.group.add(mast);

    const sailGeo = new THREE.PlaneGeometry(1.6, 1.7, 8, 8);
    const pos = sailGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x + 1) * 1.4) * 0.12 + (y + 0.8) * 0.02);
    }
    sailGeo.computeVertexNormals();
    this.sail = new THREE.Mesh(sailGeo, new THREE.MeshToonMaterial({ color: PALETTE.sail, side: THREE.DoubleSide, gradientMap: toon(PALETTE.sail).gradientMap }));
    this.sail.position.set(0.85, 1.45, 0);
    this.sail.rotation.y = 0.15;
    this.group.add(this.sail);

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), toon(PALETTE.wood));
    boom.rotation.z = Math.PI / 2;
    boom.position.set(0.7, 0.62, 0);
    this.group.add(boom);

    const emblem = new THREE.Group();
    emblem.position.set(-1.15, 0.45, 0);
    const hg = new THREE.ExtrudeGeometry(heartShape(0.22), { depth: 0.06, bevelEnabled: false });
    hg.center();
    const heart = new THREE.Mesh(hg, toon(0xe23a3a));
    emblem.add(heart);
    [0xff8ba7, 0x7bc47a, 0x7ec8e8].forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), toon(col));
      f.scale.set(0.4, 1.5, 0.25);
      f.position.set((i - 1) * 0.12, 0.18, 0.02);
      f.rotation.z = (i - 1) * 0.5;
      emblem.add(f);
    });
    this.group.add(emblem);

    const geo = new THREE.BufferGeometry();
    const n = 40;
    const verts = new Float32Array(n * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    this.wake = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.55 }),
    );
    this.wake.position.y = 0.05;
    this.group.add(this.wake);
  }

  update(t: number, speed: number) {
    this.sail.rotation.y = 0.12 + Math.sin(t * 1.6) * 0.08;
    const pos = this.wake.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, -0.4 - i * 0.08, Math.sin(t * 4 + i) * 0.04, (i % 2 === 0 ? -0.2 : 0.2) * (speed > 0.2 ? 1 : 0.2));
    }
    pos.needsUpdate = true;
    (this.wake.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp(speed * 0.4, 0.12, 0.7);
  }
}
