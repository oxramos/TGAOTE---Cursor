import * as THREE from "three";
import { PALETTE, toon, outlineClone } from "../materials";
import type { Rarity } from "../types";

function heartShape(s = 1): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, s * 0.35);
  sh.bezierCurveTo(-s * 0.15, s * 0.7, -s * 0.7, s * 0.55, -s * 0.7, s * 0.1);
  sh.bezierCurveTo(-s * 0.7, -s * 0.25, 0, -s * 0.55, 0, -s * 0.85);
  sh.bezierCurveTo(0, -s * 0.55, s * 0.7, -s * 0.25, s * 0.7, s * 0.1);
  sh.bezierCurveTo(s * 0.7, s * 0.55, s * 0.15, s * 0.7, 0, s * 0.35);
  return sh;
}

function featherShape(w = 0.07, h = 0.34): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(w, h * 0.35, w * 0.25, h);
  sh.quadraticCurveTo(0, h * 1.08, -w * 0.25, h);
  sh.quadraticCurveTo(-w, h * 0.35, 0, 0);
  return sh;
}

function canvasTex(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function evaFaceTexture(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#FFE14A";
    ctx.fillRect(0, 0, s, s);

    const cx = s * 0.5;
    const cy = s * 0.5;

    const glow = ctx.createRadialGradient(cx, cy - s * 0.08, s * 0.02, cx, cy, s * 0.28);
    glow.addColorStop(0, "rgba(255,255,232,0.7)");
    glow.addColorStop(1, "rgba(255,225,74,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);

    const blush = (x: number) => {
      const g = ctx.createRadialGradient(x, cy + s * 0.04, 2, x, cy + s * 0.04, s * 0.09);
      g.addColorStop(0, "rgba(255,120,150,0.72)");
      g.addColorStop(1, "rgba(255,139,167,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, cy + s * 0.04, s * 0.09, s * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    blush(cx - s * 0.155);
    blush(cx + s * 0.155);

    ctx.strokeStyle = "#2A1A12";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const eye = (x: number) => {
      ctx.lineWidth = s * 0.016;
      ctx.beginPath();
      ctx.arc(x, cy + s * 0.012, s * 0.042, Math.PI, 0, true);
      ctx.stroke();
      ctx.lineWidth = s * 0.01;
      const lashes: [number, number, number][] = [
        [-0.7, -s * 0.028, s * 0.038],
        [0, -s * 0.04, s * 0.046],
        [0.7, -s * 0.028, s * 0.038],
      ];
      for (const [ang, dy, len] of lashes) {
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(ang) * s * 0.012, cy - s * 0.012);
        ctx.lineTo(x + Math.sin(ang) * len * 0.55, cy - s * 0.012 + dy);
        ctx.stroke();
      }
    };
    eye(cx - s * 0.078);
    eye(cx + s * 0.078);

    ctx.lineWidth = s * 0.008;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, cy - s * 0.055);
    ctx.quadraticCurveTo(cx - s * 0.078, cy - s * 0.078, cx - s * 0.04, cy - s * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.12, cy - s * 0.055);
    ctx.quadraticCurveTo(cx + s * 0.078, cy - s * 0.078, cx + s * 0.04, cy - s * 0.05);
    ctx.stroke();
  });
}

function dressTexture(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const stripe = s / 11;
    for (let y = 0; y < s; y += stripe) {
      ctx.fillStyle = Math.floor(y / stripe) % 2 === 0 ? "#FFF6EA" : "#E23A3A";
      ctx.fillRect(0, y, s, stripe + 1);
    }
  }, 256);
}

export class Eva {
  group = new THREE.Group();
  body: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  spyglass: THREE.Group;
  tiara: THREE.Group;
  bob = 0;
  holdingGlass = false;
  pickupT = 0;
  pickupDur = 0.48;
  pickupKind: Rarity = "common";

  constructor() {
    this.body = new THREE.Group();
    this.group.add(this.body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 28, 22),
      toon(0xffffff, { map: evaFaceTexture() }),
    );
    head.position.set(0, 0.78, 0.04);
    head.rotation.y = -Math.PI / 2;
    head.scale.set(1.04, 0.96, 1.02);
    head.castShadow = true;
    this.body.add(head);
    const headOut = outlineClone(head, 0.07);
    headOut.rotation.y = -Math.PI / 2;
    this.body.add(headOut);

    for (let i = 0; i < 5; i++) {
      const fluff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toon(i % 2 ? PALETTE.evaYellow : PALETTE.evaYellowDeep));
      const a = -0.6 + (i / 4) * 1.2;
      fluff.position.set(Math.sin(a) * 0.3, 0.92 + (i % 2) * 0.06, -0.22 - Math.cos(a) * 0.08);
      fluff.scale.set(1.05, 0.7, 0.85);
      this.body.add(fluff);
    }

    const tuftColors = [PALETTE.evaYellowDeep, PALETTE.evaYellow, PALETTE.evaYellowDeep];
    tuftColors.forEach((col, i) => {
      const geo = new THREE.ExtrudeGeometry(featherShape(0.055, 0.2), { depth: 0.03, bevelEnabled: false });
      geo.center();
      const tuft = new THREE.Mesh(geo, toon(col));
      tuft.position.set((i - 1) * 0.07, 1.16, -0.02);
      tuft.rotation.z = (i - 1) * 0.38;
      tuft.rotation.x = -0.15;
      this.body.add(tuft);
    });

    const beakTop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), toon(PALETTE.beak));
    beakTop.scale.set(0.9, 0.55, 1.2);
    beakTop.position.set(0, 0.7, 0.44);
    const beakBot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), toon(0xe07030));
    beakBot.scale.set(0.85, 0.42, 1.05);
    beakBot.position.set(0, 0.64, 0.42);
    this.body.add(beakTop, beakBot);

    this.tiara = new THREE.Group();
    this.tiara.position.set(0, 1.08, 0.06);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 10, 24), toon(0xf2c14e));
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 1, 0.7);
    this.tiara.add(band);
    const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.16), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    heartGeo.center();
    const heart = new THREE.Mesh(heartGeo, toon(0xe23a3a));
    heart.position.set(0, 0.16, 0.08);
    this.tiara.add(heart);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), toon(0xffe8a0, { emissive: 0xf2c14e }));
    gem.position.set(0, 0.18, 0.12);
    this.tiara.add(gem);

    const plume = [
      { col: 0xff8ba7, x: -0.12, z: -0.04, rot: -0.5 },
      { col: 0x7bc47a, x: 0, z: -0.08, rot: 0 },
      { col: 0x7ec8e8, x: 0.12, z: -0.04, rot: 0.5 },
    ];
    for (const p of plume) {
      const geo = new THREE.ExtrudeGeometry(featherShape(0.085, 0.32), { depth: 0.03, bevelEnabled: false });
      geo.center();
      const f = new THREE.Mesh(geo, toon(p.col));
      f.position.set(p.x, 0.3, p.z);
      f.rotation.z = p.rot;
      f.rotation.x = -0.25;
      this.tiara.add(f);
    }
    this.body.add(this.tiara);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), toon(PALETTE.evaYellow));
    chest.scale.set(1.15, 0.7, 1.05);
    chest.position.set(0, 0.42, 0.02);
    this.body.add(chest);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 18), toon(0xfff6ea));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.5, 0.04);
    this.body.add(collar);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.32, 0.2, 20),
      toon(0xffffff, { map: dressTexture() }),
    );
    top.position.set(0, 0.38, 0);
    top.castShadow = true;
    this.body.add(top);

    const skirtPts = [
      new THREE.Vector2(0.3, 0.1),
      new THREE.Vector2(0.34, 0.02),
      new THREE.Vector2(0.4, -0.08),
      new THREE.Vector2(0.44, -0.16),
    ];
    const skirt = new THREE.Mesh(
      new THREE.LatheGeometry(skirtPts, 24),
      toon(0xf03434, { emissive: 0x6a1010, side: THREE.DoubleSide }),
    );
    skirt.position.y = 0.32;
    skirt.castShadow = true;
    this.body.add(skirt);

    const petticoatPts = [new THREE.Vector2(0.36, -0.12), new THREE.Vector2(0.42, -0.18), new THREE.Vector2(0.44, -0.2)];
    const petticoat = new THREE.Mesh(new THREE.LatheGeometry(petticoatPts, 20), toon(0xfff1dc, { side: THREE.DoubleSide }));
    petticoat.position.y = 0.32;
    this.body.add(petticoat);

    const waist = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 20), toon(0xc41f28));
    waist.rotation.x = Math.PI / 2;
    waist.position.y = 0.4;
    this.body.add(waist);

    this.leftWing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), toon(PALETTE.evaYellowDeep));
    this.leftWing.scale.set(0.5, 0.85, 1.45);
    this.leftWing.position.set(-0.4, 0.4, 0.06);
    this.leftWing.rotation.z = 0.45;
    this.rightWing = this.leftWing.clone();
    this.rightWing.position.x *= -1;
    this.rightWing.rotation.z *= -1;
    this.body.add(this.leftWing, this.rightWing);

    const makeFoot = (x: number) => {
      const g = new THREE.Group();
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.26, 8), toon(PALETTE.beak));
      shin.position.y = 0.16;
      g.add(shin);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), toon(PALETTE.beak));
      palm.scale.set(1.1, 0.38, 1.35);
      palm.position.set(0, 0.045, 0.03);
      g.add(palm);
      for (const tz of [-0.04, 0, 0.05]) {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.07, 3, 6), toon(PALETTE.beak));
        toe.rotation.x = Math.PI / 2;
        toe.position.set(tz * 1.4, 0.045, 0.08);
        g.add(toe);
      }
      g.position.x = x;
      return { group: g, shin };
    };
    const footL = makeFoot(-0.13);
    const footR = makeFoot(0.13);
    this.leftLeg = footL.group;
    this.rightLeg = footR.group;
    this.group.add(footL.group, footR.group);
    this.body.position.y = 0.26;

    this.spyglass = new THREE.Group();
    const tubeA = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34, 10), toon(0xff8a3d));
    const tubeB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.16, 10), toon(0x3a7ca5));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), toon(0x9fe7ff, { emissive: 0x7ec8e8 }));
    tubeA.rotation.z = Math.PI / 2;
    tubeB.rotation.z = Math.PI / 2;
    tubeB.position.x = 0.18;
    lens.rotation.y = Math.PI / 2;
    lens.position.x = 0.27;
    this.spyglass.add(tubeA, tubeB, lens);
    this.spyglass.position.set(0.3, 0.52, 0.22);
    this.spyglass.rotation.y = -0.4;
    this.spyglass.visible = false;
    this.body.add(this.spyglass);

    this.group.scale.setScalar(1.18);
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.group.add(blob);
  }

  playPickup(rarity: Rarity = "common") {
    this.pickupKind = rarity;
    this.pickupDur = rarity === "legendary" ? 1.12 : rarity === "rare" ? 0.84 : rarity === "uncommon" ? 0.62 : 0.46;
    this.pickupT = this.pickupDur;
  }

  update(
    dt: number,
    moving: boolean,
    sailing: boolean,
    spyglass: boolean,
    turnRate = 0,
    airborne = false,
    floating = false,
    sprint = false,
  ) {
    const run = moving && !airborne && !sailing;
    const flutter = floating || (airborne && !sailing);
    this.bob += dt * (flutter ? 16 : run ? (sprint ? 13.5 : 9.2) : sailing ? 3.2 : 2.2);
    const step = this.bob;
    const bounce = run ? Math.abs(Math.sin(step)) * (sprint ? 0.1 : 0.07) : flutter ? 0.06 + Math.sin(step) * 0.1 : Math.sin(step) * 0.016;
    this.body.position.y = 0.26 + bounce + (airborne && !floating ? 0.08 : 0);

    const bank = THREE.MathUtils.clamp(turnRate * 0.22, -0.42, 0.42);
    const lean = run ? (sprint ? 0.2 : 0.12) : flutter ? -0.18 : 0;

    if (this.pickupT > 0) {
      this.pickupT = Math.max(0, this.pickupT - dt);
      const u = 1 - this.pickupT / this.pickupDur;
      const scoop = Math.sin(Math.min(u * 1.25, 1) * Math.PI);
      this.body.scale.set(1, 1 - scoop * 0.08, 1);
      this.body.position.y = 0.26 - 0.28 * scoop;
      this.body.rotation.x = 0.95 * scoop;
      this.body.rotation.y = 0;
      this.body.rotation.z = 0;
      this.leftWing.rotation.z = 0.12;
      this.rightWing.rotation.z = -0.12;
      this.leftWing.rotation.x = -1.35 * scoop;
      this.rightWing.rotation.x = -1.35 * scoop;
      this.leftWing.rotation.y = 0.12 * scoop;
      this.rightWing.rotation.y = -0.12 * scoop;
      if (this.pickupKind === "legendary" && u > 0.55) {
        const hop = Math.sin((u - 0.55) / 0.45 * Math.PI);
        this.body.position.y = 0.26 + hop * 0.18;
        this.body.rotation.x = 0.12 * (1 - hop);
      }
    } else {
      this.body.scale.set(1, 1, 1);
      this.body.rotation.y = THREE.MathUtils.damp(this.body.rotation.y, 0, 8, dt);
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, bank + Math.sin(step * 0.5) * (run ? 0.05 : 0.02), 8, dt);
      this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, lean, 6, dt);

      if (flutter) {
        const flap = 1.15 + Math.sin(step) * 0.72;
        this.leftWing.rotation.z = flap;
        this.rightWing.rotation.z = -flap;
        this.leftWing.rotation.x = -0.55 + Math.sin(step * 1.4) * 0.35;
        this.rightWing.rotation.x = -0.55 - Math.sin(step * 1.4) * 0.35;
        this.leftWing.rotation.y = 0.45 + bank * 0.4;
        this.rightWing.rotation.y = -0.45 + bank * 0.4;
      } else if (run) {
        this.leftWing.rotation.z = 0.55 + Math.sin(step) * 0.42;
        this.rightWing.rotation.z = -0.55 - Math.sin(step + 0.4) * 0.42;
        this.leftWing.rotation.x = -0.28 + Math.sin(step + 0.6) * 0.22;
        this.rightWing.rotation.x = -0.28 + Math.sin(step + 1.1) * 0.22;
        this.leftWing.rotation.y = 0.2 + bank * 0.55 + Math.sin(step) * 0.18;
        this.rightWing.rotation.y = -0.2 + bank * 0.55 - Math.sin(step) * 0.18;
      } else {
        this.leftWing.rotation.z = 0.42 + Math.sin(step) * 0.1;
        this.rightWing.rotation.z = -0.42 - Math.sin(step) * 0.1;
        this.leftWing.rotation.x = THREE.MathUtils.damp(this.leftWing.rotation.x, 0, 8, dt);
        this.rightWing.rotation.x = THREE.MathUtils.damp(this.rightWing.rotation.x, 0, 8, dt);
        this.leftWing.rotation.y = THREE.MathUtils.damp(this.leftWing.rotation.y, 0.08, 8, dt);
        this.rightWing.rotation.y = THREE.MathUtils.damp(this.rightWing.rotation.y, -0.08, 8, dt);
      }
    }

    if (this.pickupT > 0) {
      this.leftLeg.rotation.x = 0.55;
      this.rightLeg.rotation.x = 0.62;
      this.leftLeg.position.y = 0.04;
      this.rightLeg.position.y = 0.05;
      this.leftLeg.position.z = 0.08;
      this.rightLeg.position.z = 0.1;
    } else if (flutter) {
      this.leftLeg.rotation.x = 0.72;
      this.rightLeg.rotation.x = 0.8;
      this.leftLeg.position.y = 0.07;
      this.rightLeg.position.y = 0.08;
      this.leftLeg.position.z = -0.06;
      this.rightLeg.position.z = -0.05;
    } else if (run) {
      const a = Math.sin(step);
      const b = Math.sin(step + Math.PI);
      this.leftLeg.rotation.x = a * 0.85;
      this.rightLeg.rotation.x = b * 0.85;
      this.leftLeg.position.z = a * 0.09;
      this.rightLeg.position.z = b * 0.09;
      this.leftLeg.position.y = Math.max(0, a) * 0.07;
      this.rightLeg.position.y = Math.max(0, b) * 0.07;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0.06, 10, dt);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0.06, 10, dt);
      this.leftLeg.position.z = THREE.MathUtils.damp(this.leftLeg.position.z, 0, 10, dt);
      this.rightLeg.position.z = THREE.MathUtils.damp(this.rightLeg.position.z, 0, 10, dt);
      this.leftLeg.position.y = THREE.MathUtils.damp(this.leftLeg.position.y, 0, 10, dt);
      this.rightLeg.position.y = THREE.MathUtils.damp(this.rightLeg.position.y, 0, 10, dt);
    }

    this.holdingGlass = spyglass;
    this.spyglass.visible = spyglass || sailing;
    if (sailing) {
      this.spyglass.position.set(0.22, 0.58, 0.28);
      this.spyglass.rotation.set(-0.2, -0.2, 0.4);
    } else if (spyglass) {
      this.spyglass.position.set(0.04, 0.78, 0.34);
      this.spyglass.rotation.set(-0.15, 0, 0.9);
    }
    this.tiara.rotation.z = Math.sin(this.bob * 0.5) * 0.05 + bank * 0.15;
  }
}
