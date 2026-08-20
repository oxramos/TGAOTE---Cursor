import * as THREE from "three";

export const PALETTE = {
  evaYellow: 0xffe14a,
  evaYellowDeep: 0xf0c43a,
  evaBelly: 0xfff3a8,
  beak: 0xff8a3d,
  blush: 0xff8ba7,
  skirt: 0xe23a3a,
  top: 0x8b7cff,
  boatRed: 0xe03131,
  sail: 0xf4e6c8,
  wood: 0xc48a4a,
  woodDeep: 0x8a5a32,
  grass: 0x6fbf6a,
  grassDeep: 0x3e8f5a,
  grassTip: 0x9ed96a,
  sand: 0xf2d7a6,
  sandWet: 0xe2c08a,
  dirt: 0xc4a06a,
  waterShallow: new THREE.Color("#5ad4d8"),
  waterDeep: new THREE.Color("#1a5fad"),
  foam: new THREE.Color("#eef9ff"),
  roof: 0xb4232c,
  cottage: 0xf6e27a,
  stone: 0xc9c4b8,
  stoneDeep: 0x8d8778,
  outline: 0x3a2a40,
};

let toonRamp: THREE.DataTexture | null = null;

export function getToonRamp(): THREE.DataTexture {
  if (toonRamp) return toonRamp;
  const steps = 4;
  const data = new Uint8Array(steps * 4);
  const levels = [0.42, 0.62, 0.82, 1.0];
  for (let i = 0; i < steps; i++) {
    const b = Math.round(levels[i] * 255);
    data[i * 4 + 0] = b;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  toonRamp = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  toonRamp.minFilter = THREE.NearestFilter;
  toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

export function toon(
  color: number,
  opts?: { emissive?: number; roughness?: number; map?: THREE.Texture; transparent?: boolean; opacity?: number; side?: THREE.Side },
): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color,
    map: opts?.map,
    gradientMap: getToonRamp(),
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissive ? 0.45 : 0,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    side: opts?.side ?? THREE.FrontSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float rim = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);
      outgoingLight += diffuseColor.rgb * rim * 0.16;
      outgoingLight += vec3(1.0, 0.95, 0.82) * pow(max(dot(reflect(-normalize(vViewPosition), normal), normalize(vViewPosition)), 0.0), 28.0) * 0.18;
      #include <opaque_fragment>
      `,
    );
  };
  return mat;
}

export function lambert(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

export const outlineMat = new THREE.MeshBasicMaterial({
  color: PALETTE.outline,
  side: THREE.BackSide,
});

export function addOutline(mesh: THREE.Mesh, scale = 1.06): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.copy(mesh.scale).multiplyScalar(scale);
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.castShadow = false;
  outline.receiveShadow = false;
  if (mesh.parent) mesh.parent.add(outline);
  return outline;
}

export function outlineClone(src: THREE.Mesh, extra = 0.045): THREE.Mesh {
  const m = new THREE.Mesh(src.geometry, outlineMat);
  m.position.copy(src.position);
  m.rotation.copy(src.rotation);
  m.scale.copy(src.scale).multiplyScalar(1 + extra);
  m.castShadow = false;
  return m;
}

export function iridescent(base: number): THREE.ShaderMaterial {
  const c = new THREE.Color(base);
  return new THREE.ShaderMaterial({
    lights: false,
    uniforms: {
      uColor: { value: c },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vV;
      vec3 hsv(float h, float s, float v) {
        vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0);
        vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0);
        return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
      }
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float fres = pow(1.0 - abs(dot(n, v)), 2.2);
        vec3 ir = hsv(fract(fres * 1.8 + uTime * 0.08), 0.65, 1.0);
        vec3 col = mix(uColor, ir, 0.55 * fres + 0.2);
        float spec = pow(max(dot(reflect(-v, n), v), 0.0), 20.0);
        col += spec * 0.45;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function glowSprite(color: number, size = 1.6): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  const c = new THREE.Color(color);
  g.addColorStop(0, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.9)`);
  g.addColorStop(0.4, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.35)`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}
