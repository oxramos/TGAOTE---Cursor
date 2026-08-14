import * as THREE from "three";

const VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

const FRAG = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
varying vec3 vDir;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

void main() {
  vec3 n = normalize(vDir);
  float h = n.y;
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.75, h));
  col = mix(uNadir, col, smoothstep(-0.15, 0.08, h));
  vec3 sd = normalize(uSunDir);
  float sun = pow(max(dot(n, sd), 0.0), 140.0);
  float glow = pow(max(dot(n, sd), 0.0), 6.0);
  col += uSunColor * sun * 1.4;
  col += uSunColor * glow * 0.28 * (1.0 - uNight * 0.5);

  float stars = step(0.9965, hash(floor(n * 140.0)));
  col += vec3(stars) * uNight;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  group = new THREE.Group();
  material: THREE.ShaderMaterial;
  sun: THREE.Mesh;
  moon: THREE.Mesh;
  clouds: THREE.Group;
  hemi: THREE.HemisphereLight;
  dir: THREE.DirectionalLight;
  amb: THREE.AmbientLight;
  sunDir = new THREE.Vector3();
  night = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color("#7ec8f8") },
        uHorizon: { value: new THREE.Color("#ffd4b8") },
        uNadir: { value: new THREE.Color("#3a90d4") },
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
        uSunColor: { value: new THREE.Color("#fff1c2") },
        uNight: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 20), this.material);
    this.group.add(dome);

    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false, toneMapped: false });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 16), sunMat);
    this.group.add(this.sun);

    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false, toneMapped: false });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), moonMat);
    this.group.add(this.moon);

    this.clouds = new THREE.Group();
    this.group.add(this.clouds);
    this.makeClouds();

    this.hemi = new THREE.HemisphereLight(0x9ed7ff, 0x8bc47a, 0.85);
    this.group.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xfff2d1, 2.1);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(2048, 2048);
    this.dir.shadow.camera.near = 1;
    this.dir.shadow.camera.far = 220;
    this.dir.shadow.camera.left = -90;
    this.dir.shadow.camera.right = 90;
    this.dir.shadow.camera.top = 90;
    this.dir.shadow.camera.bottom = -90;
    this.dir.shadow.bias = -0.00025;
    this.dir.shadow.radius = 2.5;
    this.group.add(this.dir);
    this.amb = new THREE.AmbientLight(0xffe6c8, 0.28);
    this.group.add(this.amb);
  }

  private makeClouds() {
    const puff = (x: number, y: number, z: number, s: number, c: number) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 8),
        new THREE.MeshLambertMaterial({ color: c }),
      );
      m.position.set(x, y, z);
      m.scale.set(s * 1.6, s, s * 1.1);
      m.castShadow = false;
      return m;
    };
    const spots = [
      [40, 42, -30],
      [-70, 48, 20],
      [10, 55, 80],
      [120, 46, 10],
      [-40, 50, -90],
      [80, 44, -70],
      [-110, 52, 60],
    ];
    for (const [x, y, z] of spots) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.add(puff(0, 0, 0, 6.5, 0xffffff));
      g.add(puff(6, -0.6, 1.5, 5, 0xf8fbff));
      g.add(puff(-5.5, -0.8, -1, 4.6, 0xfff6ea));
      this.clouds.add(g);
    }
  }

  update(timeOfDay: number, dt: number) {
    const ang = (timeOfDay - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(ang) * 0.7, Math.sin(ang), Math.sin(ang * 0.4) * 0.35).normalize();
    if (this.sunDir.y < 0.02) this.sunDir.y = Math.min(this.sunDir.y, 0.02);

    const night = THREE.MathUtils.smoothstep(0.08, -0.05, this.sunDir.y);
    this.night = night;

    const zenith = new THREE.Color().lerpColors(new THREE.Color("#7ec8f8"), new THREE.Color("#0b1830"), night);
    const horizon = new THREE.Color().lerpColors(new THREE.Color("#ffd4b8"), new THREE.Color("#2a1a3a"), night);
    const sunset = THREE.MathUtils.clamp(1 - Math.abs(this.sunDir.y) * 3.2, 0, 1) * (1 - night);
    horizon.lerp(new THREE.Color("#ff8a5b"), sunset * 0.65);
    zenith.lerp(new THREE.Color("#f2c14e"), sunset * 0.15);
    const nadir = new THREE.Color().lerpColors(new THREE.Color("#3a90d4"), new THREE.Color("#0a2038"), night);

    this.material.uniforms.uZenith.value.copy(zenith);
    this.material.uniforms.uHorizon.value.copy(horizon);
    this.material.uniforms.uNadir.value.copy(nadir);
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
    this.material.uniforms.uNight.value = night;
    this.material.uniforms.uSunColor.value.set(night > 0.6 ? "#c8d6ff" : "#fff1c2");

    this.sun.position.copy(this.sunDir).multiplyScalar(240);
    this.moon.position.copy(this.sunDir).multiplyScalar(-220);
    this.sun.visible = night < 0.85;
    this.moon.visible = night > 0.35;

    this.dir.position.copy(this.sunDir).multiplyScalar(80);
    this.dir.target.position.set(0, 0, 0);
    this.dir.intensity = THREE.MathUtils.lerp(2.15, 0.18, night);
    this.dir.color.set(sunset > 0.3 ? "#ffd1a3" : night > 0.5 ? "#9bb4ff" : "#fff2d1");
    this.hemi.intensity = THREE.MathUtils.lerp(0.9, 0.22, night);
    this.amb.intensity = THREE.MathUtils.lerp(0.32, 0.08, night);

    this.clouds.children.forEach((c, i) => {
      c.position.x += Math.sin(timeOfDay * 20 + i) * dt * 0.6;
      (c as THREE.Object3D).visible = night < 0.75;
    });
  }
}
