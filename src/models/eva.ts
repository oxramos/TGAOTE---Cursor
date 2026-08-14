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

export class Eva {
  group = new THREE.Group();
  body: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  spyglass: THREE.Group;
  tiara: THREE.Group;
  bob = 0;
  holdingGlass = false;

  constructor() {
    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 18), toon(PALETTE.evaYellow));
    torso.scale.set(1.05, 0.95, 0.98);
    torso.castShadow = true;
    this.body.add(torso);
    this.body.add(outlineClone(torso, 0.07));

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), toon(PALETTE.evaBelly));
    belly.position.set(0, -0.06, 0.18);
    belly.scale.set(1.1, 0.9, 0.7);
    this.body.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 18), toon(PALETTE.evaYellow));
    head.position.set(0, 0.48, 0.04);
    head.castShadow = true;
    this.body.add(head);
    const headOut = outlineClone(head, 0.07);
    this.body.add(headOut);

    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), toon(PALETTE.evaYellowDeep));
    tuft.position.set(0, 0.82, 0.02);
    tuft.scale.set(0.7, 1.3, 0.5);
    this.body.add(tuft);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 10), toon(PALETTE.beak));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.44, 0.36);
    this.body.add(beak);

    const blushMat = toon(PALETTE.blush);
    const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), blushMat);
    blushL.position.set(-0.2, 0.42, 0.3);
    const blushR = blushL.clone();
    blushR.position.x *= -1;
    this.body.add(blushL, blushR);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a12 });
    const makeEye = (x: number) => {
      const g = new THREE.Group();
      const lid = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 10, Math.PI), eyeMat);
      lid.rotation.z = Math.PI;
      lid.position.set(x, 0.52, 0.3);
      lid.rotation.x = -0.25;
      g.add(lid);
      for (let i = 0; i < 3; i++) {
        const lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.05, 3, 6), eyeMat);
        lash.position.set(x - 0.04 + i * 0.04, 0.58, 0.3);
        lash.rotation.z = -0.5 + i * 0.5;
        g.add(lash);
      }
      return g;
    };
    this.body.add(makeEye(-0.13), makeEye(0.13));

    this.tiara = new THREE.Group();
    this.tiara.position.set(0, 0.78, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 20), toon(0xf2c14e));
    ring.rotation.x = Math.PI / 2;
    this.tiara.add(ring);
    const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.11), { depth: 0.04, bevelEnabled: false });
    heartGeo.center();
    const heart = new THREE.Mesh(heartGeo, toon(0xe23a3a));
    heart.position.set(0, 0.12, 0.02);
    this.tiara.add(heart);
    const feathers = [0xff8ba7, 0x7bc47a, 0x7ec8e8];
    feathers.forEach((col, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), toon(col));
      f.scale.set(0.45, 1.4, 0.25);
      f.position.set((i - 1) * 0.1, 0.16, -0.04);
      f.rotation.z = (i - 1) * 0.4;
      this.tiara.add(f);
    });
    this.body.add(this.tiara);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.22, 16), toon(PALETTE.top));
    top.position.set(0, 0.12, 0);
    this.body.add(top);

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.32, 16, 1, true), toon(PALETTE.skirt));
    skirt.position.set(0, -0.18, 0);
    skirt.castShadow = true;
    this.body.add(skirt);
    this.body.add(outlineClone(skirt, 0.05));

    this.leftWing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(PALETTE.beak));
    this.leftWing.scale.set(0.55, 0.9, 1.2);
    this.leftWing.position.set(-0.42, 0.08, 0.02);
    this.rightWing = this.leftWing.clone();
    this.rightWing.position.x *= -1;
    this.body.add(this.leftWing, this.rightWing);

    this.leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.18, 6), toon(PALETTE.skirt));
    this.leftLeg.position.set(-0.12, -0.42, 0.04);
    this.rightLeg = this.leftLeg.clone();
    this.rightLeg.position.x *= -1;
    const footL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(PALETTE.beak));
    footL.scale.set(1, 0.4, 1.4);
    footL.position.set(-0.12, -0.52, 0.06);
    const footR = footL.clone();
    footR.position.x *= -1;
    this.group.add(this.leftLeg, this.rightLeg, footL, footR);

    this.spyglass = new THREE.Group();
    const tubeA = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34, 10), toon(0xff8a3d));
    const tubeB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.16, 10), toon(0x3a7ca5));
    tubeA.rotation.z = Math.PI / 2;
    tubeB.rotation.z = Math.PI / 2;
    tubeB.position.x = 0.18;
    this.spyglass.add(tubeA, tubeB);
    this.spyglass.position.set(0.28, 0.34, 0.22);
    this.spyglass.rotation.y = -0.4;
    this.spyglass.visible = false;
    this.body.add(this.spyglass);

    this.group.scale.setScalar(1.05);
  }

  update(dt: number, moving: boolean, sailing: boolean, spyglass: boolean) {
    this.bob += dt * (moving ? 10 : 2.4);
    const bounce = Math.sin(this.bob) * (moving ? 0.06 : 0.018);
    this.body.position.y = bounce;
    this.body.rotation.z = Math.sin(this.bob * 0.5) * (moving ? 0.08 : 0.03);
    this.leftWing.rotation.z = 0.4 + Math.sin(this.bob) * (moving ? 0.5 : 0.12);
    this.rightWing.rotation.z = -0.4 - Math.sin(this.bob) * (moving ? 0.5 : 0.12);
    this.leftLeg.rotation.x = moving ? Math.sin(this.bob) * 0.7 : 0.1;
    this.rightLeg.rotation.x = moving ? Math.cos(this.bob) * 0.7 : 0.1;
    this.holdingGlass = spyglass;
    this.spyglass.visible = spyglass || sailing;
    if (sailing) {
      this.spyglass.position.set(0.22, 0.38, 0.28);
      this.spyglass.rotation.set(-0.2, -0.2, 0.4);
    } else if (spyglass) {
      this.spyglass.position.set(0.05, 0.5, 0.32);
      this.spyglass.rotation.set(-0.15, 0, 0.9);
    }
    this.tiara.rotation.z = Math.sin(this.bob * 0.5) * 0.05;
  }
}
