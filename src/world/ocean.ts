import * as THREE from "three";
import { PALETTE } from "../materials";
import { ISLANDS } from "../catalog";

const VERT = `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNrm;
varying float vPeak;

void gerstner(inout vec3 p, inout vec3 tng, inout vec3 btm, vec2 dir, float steep, float wl, float speed) {
  float k = 6.28318 / wl;
  float a = steep / k;
  float c = sqrt(9.8 / k) * speed;
  float f = k * (dot(dir, p.xz) - c * uTime);
  float sinf = sin(f);
  float cosf = cos(f);
  p.x += dir.x * a * cosf;
  p.z += dir.y * a * cosf;
  p.y += a * sinf;
  tng += vec3(-dir.x * dir.x * steep * sinf, dir.x * steep * cosf, -dir.x * dir.y * steep * sinf);
  btm += vec3(-dir.x * dir.y * steep * sinf, dir.y * steep * cosf, -dir.y * dir.y * steep * sinf);
}

void main() {
  vec3 p = position;
  vec3 tng = vec3(1.0, 0.0, 0.0);
  vec3 btm = vec3(0.0, 0.0, 1.0);
  gerstner(p, tng, btm, normalize(vec2(1.0, 0.35)), 0.22, 18.0, 0.85);
  gerstner(p, tng, btm, normalize(vec2(-0.4, 1.0)), 0.16, 11.0, 1.1);
  gerstner(p, tng, btm, normalize(vec2(0.6, -0.8)), 0.10, 6.5, 1.3);
  vPeak = p.y;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNrm = normalize(mat3(modelMatrix) * normalize(cross(btm, tng)));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSun;
uniform float uTime;
uniform vec4 uIslands[8];
uniform int uCount;
varying vec3 vWorld;
varying vec3 vNrm;
varying float vPeak;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 n = normalize(vNrm);
  vec3 v = normalize(cameraPosition - vWorld);
  float ndl = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
  float band = ndl < 0.55 ? 0.72 : ndl < 0.82 ? 0.88 : 1.0;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float depthMix = clamp((vWorld.y + 0.4) * 0.35 + 0.35, 0.0, 1.0);
  vec3 col = mix(uDeep, uShallow, depthMix);
  col *= band;
  col = mix(col, vec3(0.55, 0.82, 1.0), fres * 0.45);

  float foam = smoothstep(0.32, 0.55, vPeak);
  float shore = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    float d = length(vWorld.xz - uIslands[i].xy) - uIslands[i].z;
    float ring = 1.0 - smoothstep(0.0, 3.4, abs(d - 0.4));
    shore = max(shore, ring);
  }
  foam = max(foam * 0.55, shore);
  col = mix(col, uFoam, foam * 0.85);

  float spec = pow(max(dot(reflect(-normalize(uSun), n), v), 0.0), 80.0);
  col += vec3(1.0, 0.97, 0.88) * spec * 0.65;

  float spark = step(0.996, hash(floor(vWorld.xz * 2.4 + uTime * 0.8)));
  col += spark * 0.55;

  gl_FragColor = vec4(col, 0.96);
}
`;

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(520, 520, 160, 160);
    geo.rotateX(-Math.PI / 2);
    const islands = ISLANDS.slice(0, 8).map(
      (i) => new THREE.Vector4(i.x, i.z, i.radius * 0.92, 0),
    );
    while (islands.length < 8) islands.push(new THREE.Vector4(0, 0, 0, 0));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: PALETTE.waterDeep },
        uShallow: { value: PALETTE.waterShallow },
        uFoam: { value: PALETTE.foam },
        uSun: { value: new THREE.Vector3(0.35, 0.82, 0.4) },
        uIslands: { value: islands },
        uCount: { value: Math.min(8, ISLANDS.length) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
  }

  height(x: number, z: number, t: number): number {
    const wave = (dirx: number, dirz: number, steep: number, wl: number, speed: number) => {
      const k = (Math.PI * 2) / wl;
      const a = steep / k;
      const c = Math.sqrt(9.8 / k) * speed;
      const f = k * (dirx * x + dirz * z - c * t);
      return a * Math.sin(f);
    };
    const d1 = new THREE.Vector2(1, 0.35).normalize();
    const d2 = new THREE.Vector2(-0.4, 1).normalize();
    const d3 = new THREE.Vector2(0.6, -0.8).normalize();
    return (
      wave(d1.x, d1.y, 0.22, 18, 0.85) +
      wave(d2.x, d2.y, 0.16, 11, 1.1) +
      wave(d3.x, d3.y, 0.1, 6.5, 1.3)
    );
  }

  update(t: number, sun: THREE.Vector3) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uSun.value.copy(sun);
  }
}
