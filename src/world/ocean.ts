import * as THREE from "three";
import { PALETTE } from "../materials";
import { ISLANDS } from "../catalog";
import { coastRadius } from "./islands";

const VERT = `
uniform float uTime;
uniform vec4 uIslands[8];
uniform int uCount;
varying vec3 vWorld;
varying vec3 vNrm;
varying float vPeak;
varying float vCover;

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

float islandCover(vec2 xz) {
  float cover = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    float d = length(xz - uIslands[i].xy);
    float R = uIslands[i].z;
    cover = max(cover, 1.0 - smoothstep(R - 0.6, R + 3.4, d));
  }
  return clamp(cover, 0.0, 1.0);
}

void main() {
  vec3 p = position;
  vec3 tng = vec3(1.0, 0.0, 0.0);
  vec3 btm = vec3(0.0, 0.0, 1.0);
  gerstner(p, tng, btm, normalize(vec2(1.0, 0.35)), 0.09, 24.0, 0.7);
  gerstner(p, tng, btm, normalize(vec2(-0.4, 1.0)), 0.055, 14.0, 0.92);
  gerstner(p, tng, btm, normalize(vec2(0.6, -0.8)), 0.032, 8.0, 1.08);
  vCover = islandCover(p.xz);
  float damp = mix(1.0, 0.0, smoothstep(0.12, 0.78, vCover));
  p.y *= damp;
  p.y -= vCover * 0.95;
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
uniform float uNight;
uniform vec4 uIslands[8];
uniform int uCount;
varying vec3 vWorld;
varying vec3 vNrm;
varying float vPeak;
varying float vCover;

void main() {
  if (vCover > 0.42) discard;

  vec3 n = normalize(vNrm);
  vec3 v = normalize(cameraPosition - vWorld);
  float ndl = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
  float band = ndl < 0.55 ? 0.72 : ndl < 0.82 ? 0.88 : 1.0;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float lookDown = smoothstep(0.28, 0.72, v.y);
  float depthMix = clamp((vWorld.y + 0.28) * 0.38 + 0.4, 0.0, 1.0);
  vec3 deep = mix(uDeep, vec3(0.05, 0.2, 0.34), uNight);
  vec3 shallow = mix(uShallow, vec3(0.16, 0.4, 0.52), uNight * 0.65);
  vec3 col = mix(deep, shallow, depthMix * (1.0 - lookDown * 0.35));
  col *= band;
  col = mix(col, vec3(0.42, 0.7, 0.88), fres * 0.22 * (1.0 - uNight * 0.55) * (1.0 - lookDown));

  float shore = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    float d = length(vWorld.xz - uIslands[i].xy) - uIslands[i].z;
    float ring = 1.0 - smoothstep(0.0, 2.8, abs(d - 0.8));
    shore = max(shore, ring);
  }
  float foam = shore * 0.62 * (1.0 - vCover) * (1.0 - lookDown * 0.4);
  foam = max(foam, smoothstep(0.22, 0.4, vPeak) * 0.18 * (1.0 - vCover));
  col = mix(col, uFoam, foam * 0.55);

  float spec = pow(max(dot(reflect(-normalize(uSun), n), v), 0.0), 110.0);
  col += vec3(1.0, 0.97, 0.88) * spec * 0.28 * (1.0 - uNight * 0.45) * (1.0 - lookDown * 0.5);

  gl_FragColor = vec4(col, 1.0);
}
`;

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function coverRadius(i: (typeof ISLANDS)[number]) {
  let m = 0;
  for (let k = 0; k < 36; k++) m = Math.max(m, coastRadius(i, (k / 36) * Math.PI * 2));
  return m;
}

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(520, 520, 160, 160);
    geo.rotateX(-Math.PI / 2);
    const islands = ISLANDS.slice(0, 8).map((i) => new THREE.Vector4(i.x, i.z, coverRadius(i), 0));
    while (islands.length < 8) islands.push(new THREE.Vector4(0, 0, 0, 0));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: PALETTE.waterDeep },
        uShallow: { value: PALETTE.waterShallow },
        uFoam: { value: PALETTE.foam },
        uSun: { value: new THREE.Vector3(0.35, 0.82, 0.4) },
        uNight: { value: 0 },
        uIslands: { value: islands },
        uCount: { value: Math.min(8, ISLANDS.length) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
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
    let h =
      wave(d1.x, d1.y, 0.09, 24, 0.7) +
      wave(d2.x, d2.y, 0.055, 14, 0.92) +
      wave(d3.x, d3.y, 0.032, 8, 1.08);
    let cover = 0;
    for (const isl of ISLANDS) {
      const d = Math.hypot(x - isl.x, z - isl.z);
      const R = coverRadius(isl);
      cover = Math.max(cover, 1 - smoothstep(R - 0.6, R + 3.4, d));
    }
    const damp = 1 - smoothstep(0.12, 0.78, cover);
    h *= damp;
    h -= cover * 0.95;
    return h;
  }

  update(t: number, sun: THREE.Vector3, night = 0) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uSun.value.copy(sun);
    this.material.uniforms.uNight.value = night;
  }
}
