import "./style.css";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Input } from "./input";
import { Eva } from "./models/eva";
import { RedBoat } from "./models/boat";
import { Sky } from "./world/sky";
import { Ocean } from "./world/ocean";
import { buildArchipelago, heightAt, nearestIsland, beachPoint, berthPoint, pierBerth, pierCleat, PIER_ANG, houseWorldOffset, pushToWater, isLand } from "./world/islands";
import { CollectibleWorld } from "./world/collectibles";
import { buildInterior, fillShelf, rebuildDecor, type InteriorRoom } from "./world/interior";
import { createNpc } from "./models/animals";
import { InspectView } from "./inspect";
import { AudioBed } from "./audio";
import { freshSave, loadSave, writeSave } from "./save";
import { glowSprite, toon } from "./materials";
import { ITEMS, ISLANDS, NPCS, SLEEP_LINES } from "./catalog";
import type { GameState, NpcId, Rarity, SaveData, TradeRecipe } from "./types";
import type { HouseKind } from "./models/houses";
import type { HouseAnchor } from "./world/islands";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Game {
  renderer: THREE.WebGLRenderer;
  world = new THREE.Scene();
  interiorScene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  renderPass: RenderPass;
  bloom: UnrealBloomPass;
  input: Input;
  sky = new Sky();
  ocean = new Ocean();
  eva = new Eva();
  boat = new RedBoat();
  collect = new CollectibleWorld();
  inspect: InspectView;
  audio = new AudioBed();
  save: SaveData = freshSave();
  state: GameState = "title";
  houses: HouseAnchor[] = [];
  colliders: { x: number; z: number; r: number }[] = [];
  interiors = new Map<HouseKind, InteriorRoom>();
  currentInterior: InteriorRoom | null = null;
  npcs = new Map<NpcId, THREE.Group>();
  clock = new THREE.Clock();
  elapsed = 0;
  camYaw = 0.7;
  camPitch = 0.38;
  camDist = 11;
  private worldCam = { yaw: 0.7, pitch: 0.38, dist: 11 };
  fov = 48;
  sailing = false;
  boatSpeed = 0;
  boatYaw = -0.6;
  private sailAmount = 0.45;
  private windYaw = 0.7;
  private windSpeed = 6.4;
  private sailedHint = false;
  spyglass = false;
  decorate = false;
  talkingTo: NpcId | null = null;
  dialogueMode: "main" | "trade" = "main";
  ray = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  bannerT = 0;
  prompt = "";
  interact: (() => void) | null = null;
  exitPos = new THREE.Vector3();
  invTab: "finds" | "decor" = "finds";
  shelfIndex = 0;
  private moveFwd = new THREE.Vector3();
  private moveRight = new THREE.Vector3();
  private moveUp = new THREE.Vector3(0, 1, 0);
  private flyLoot: { mesh: THREE.Group; origin: THREE.Vector3; t: number; rarity: Rarity; color: number }[] = [];
  private sparkles: { sprite: THREE.Sprite; life: number }[] = [];
  private evaVy = 0;
  private grounded = true;
  private floating = false;
  private turnRate = 0;
  private lastYaw = 0;
  private houseInside: HouseAnchor | null = null;
  private mooringRope: THREE.Mesh;
  private mooringStake: THREE.Mesh;
  private ropeUp = new THREE.Vector3(0, 1, 0);
  private ropeDir = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(this.fov, innerWidth / innerHeight, 0.1, 500);
    this.world.fog = new THREE.FogExp2(0x8ec8e8, 0.0042);
    this.world.add(this.sky.group);
    this.world.add(this.ocean.mesh);
    this.world.add(this.eva.group);
    this.world.add(this.boat.group);
    this.world.add(this.collect.group);

    this.mooringRope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), toon(0xc48a4a));
    this.mooringRope.castShadow = true;
    this.mooringRope.visible = false;
    this.world.add(this.mooringRope);
    this.mooringStake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8), toon(0x8a5a32));
    this.mooringStake.castShadow = true;
    this.mooringStake.visible = false;
    this.world.add(this.mooringStake);

    const built = buildArchipelago(this.world);
    this.houses = built.houses;
    this.colliders = built.colliders;
    this.placeNpcs();

    this.interiors.set("home", buildInterior("home"));
    this.interiors.set("mallow", buildInterior("mallow"));
    this.interiors.set("pebble", buildInterior("pebble"));
    this.interiors.set("coral", buildInterior("coral"));
    this.interiors.set("brine", buildInterior("brine"));
    this.interiorScene.background = new THREE.Color("#f6e4b0");

    this.renderPass = new RenderPass(this.world, this.camera);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input = new Input(canvas);
    this.inspect = new InspectView($<HTMLCanvasElement>("inspect-canvas"));

    window.addEventListener("resize", () => this.resize());
    this.bindUi();
    this.refreshContinue();
  }

  private placeNpcs() {
    (Object.keys(NPCS) as NpcId[]).forEach((id) => {
      const def = NPCS[id];
      const isl = ISLANDS.find((i) => i.id === def.island)!;
      const mesh = createNpc(id);
      const house = this.houses.find((h) => h.island === def.island);
      const x = (house?.position.x ?? isl.x) + 3.4;
      const z = (house?.position.z ?? isl.z) + 2.6;
      mesh.position.set(x, heightAt(x, z), z);
      this.world.add(mesh);
      this.npcs.set(id, mesh);
    });
  }

  private bindUi() {
    $("btn-new").onclick = () => this.begin(false);
    $("btn-continue").onclick = () => this.begin(true);
    $("btn-resume").onclick = () => this.setState("world");
    $("btn-save").onclick = () => {
      this.persist();
      this.toast("Game saved — the tide will remember.");
    };
    $("btn-title").onclick = () => {
      this.persist();
      this.setState("title");
    };
    $("btn-close-inv").onclick = () => this.setState(this.currentInterior ? "interior" : "world");
    $("btn-close-shelf").onclick = () => this.setState("interior");
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.invTab = (tab as HTMLElement).dataset.tab === "decor" ? "decor" : "finds";
        this.renderInventory();
      });
    });
    $("hud-wind").onclick = (e) => {
      e.stopPropagation();
      this.callWind();
    };
  }

  private refreshContinue() {
    const has = !!loadSave();
    $("btn-continue").hidden = !has;
  }

  start() {
    const shot = new URLSearchParams(location.search).get("shot");
    if (shot) {
      this.begin(false);
      this.applyShot(shot);
    }
    this.loop();
  }

  begin(fromSave: boolean) {
    this.save = fromSave && loadSave() ? loadSave()! : freshSave();
    this.sailing = this.save.eva.sailing;
    this.eva.group.position.set(this.save.eva.x, heightAt(this.save.eva.x, this.save.eva.z), this.save.eva.z);
    this.boat.group.position.set(this.save.boat.x, 0.2, this.save.boat.z);
    this.boatYaw = this.save.boat.yaw;
    this.boat.group.rotation.y = this.boatYaw;
    this.collect.spawn(this.save.collected, this.save.day);
    if (!this.sailing) {
      const isl = nearestIsland(this.save.eva.x, this.save.eva.z) ?? ISLANDS[0];
      this.moorAt(isl);
    } else {
      this.settleBoat();
    }
    this.setState("world");
    this.audio.resume();
    $("title-screen").classList.add("hidden");
    $("hud").classList.remove("hidden");
    if (!new URLSearchParams(location.search).get("shot")) {
      this.toast(fromSave ? "Welcome back, little admiral." : "A new day begins on the high seas.");
    }
  }

  setState(s: GameState) {
    this.state = s;
    $("pause-screen").classList.toggle("hidden", s !== "paused");
    $("title-screen").classList.toggle("hidden", s !== "title");
    $("hud").classList.toggle("hidden", s === "title");
    $("dialogue").classList.toggle("hidden", s !== "dialogue");
    $("inspect").classList.toggle("hidden", s !== "inspect");
    $("inventory").classList.toggle("hidden", s !== "inventory");
    $("shelf-picker").classList.toggle("hidden", s !== "shelf");
    $("sleep-overlay").classList.toggle("hidden", s !== "sleeping");
    $("touch-hud").classList.toggle("hidden", s !== "world" && s !== "interior");
    if (s === "title") this.refreshContinue();
    if (s !== "inspect") this.inspect.hide();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    this.update(dt);
    this.render();
    this.input.endFrame();
  };

  private update(dt: number) {
    this.input.beginFrame();
    if (this.state === "title") {
      this.sky.update(0.32, dt);
      this.ocean.update(this.elapsed, this.sky.sunDir);
      const bob = Math.sin(this.elapsed * 0.22) * 1.4;
      this.camera.position.set(26 + bob, 11.5, 34);
      this.camera.lookAt(-6, 2.4, -8);
      this.camera.fov = 46;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.input.consume("Escape")) {
      if (this.state === "inspect") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "inventory" || this.state === "shelf") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "dialogue") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "paused") this.setState(this.currentInterior ? "interior" : "world");
      else this.setState("paused");
    }
    if (this.state === "paused" || this.state === "sleeping") return;

    if (this.input.consume("Tab")) {
      if (this.state === "inventory") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "world" || this.state === "interior") {
        this.setState("inventory");
        this.renderInventory();
      }
    }

    if (this.state === "inspect") {
      this.inspect.render(this.elapsed);
      return;
    }
    if (this.state === "inventory" || this.state === "shelf") return;

    const playable = this.state === "world" || this.state === "interior" || this.state === "dialogue";
    if (!playable) return;

    if (this.state !== "dialogue") {
      this.save.time = (this.save.time + dt * 0.0035) % 1;
      this.sky.update(this.save.time, dt);
      const fog = this.world.fog as THREE.FogExp2;
      fog.color.copy(this.sky.material.uniforms.uHorizon.value);
      this.ocean.update(this.elapsed, this.sky.sunDir);
      this.collect.update(this.elapsed);
      this.world.traverse((o) => {
        if (o.name === "buoy") o.position.y = 0.25 + Math.sin(this.elapsed * 1.5 + o.position.x) * 0.12;
        if (o.name === "chimney-puff") {
          const phase = (o.userData.phase as number) ?? 0;
          const base = (o.userData.baseY as number) ?? o.position.y;
          const u = (this.elapsed * 0.35 + phase) % 1;
          o.position.y = base + u * 0.85;
          const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
          if (mat.opacity !== undefined) mat.opacity = 0.32 * (1 - u);
        }
      });
      this.updateLootFly(dt);
    }

    if (this.state === "dialogue") {
      this.updateCamera(dt);
      this.updateHud();
      return;
    }

    const mouse = this.input.mouseDelta();
    const touchLook = document.documentElement.classList.contains("touch-on");
    const inside = !!this.currentInterior;
    const lookMul = inside ? 1.55 : 1;
    this.camYaw -= mouse.x * (touchLook ? 0.0076 : 0.005) * lookMul;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + mouse.y * (touchLook ? 0.0062 : 0.004) * lookMul, 0.1, 1.15);
    const minZoom = inside ? 2.1 : 5;
    const maxZoom = inside ? 5.4 : 22;
    this.camDist = THREE.MathUtils.clamp(this.camDist + this.input.consumeWheel() * 0.01, minZoom, maxZoom);

    this.spyglass = this.input.pressed("KeyF") && !this.currentInterior;
    $("spyglass-rim").classList.toggle("hidden", !this.spyglass);

    if (this.currentInterior) this.updateInterior(dt);
    else this.updateWorld(dt);

    this.eva.update(dt, this.isMoving(), this.sailing, this.spyglass, this.turnRate, !this.grounded && !this.sailing, this.floating);
    this.updateCamera(dt);
    this.updateHud();
    this.gatherPrompt();
    this.armTouchGo();
    if (this.input.consume("KeyE") && this.interact) this.interact();
    if (this.input.consumeClick()) this.onClick();
  }

  private isMoving() {
    const a = this.input.moveAxis();
    return Math.abs(a.x) + Math.abs(a.z) > 0 && !this.sailing;
  }

  private isNight() {
    return this.save.time > 0.78 || this.save.time < 0.18;
  }

  private updateWorld(dt: number) {
    const night = this.isNight();
    this.npcs.forEach((mesh) => (mesh.visible = !night));
    this.updateWind(dt);

    if (this.sailing) {
      if (this.input.consume("KeyC")) this.callWind();
      const axis = this.input.moveAxis();
      this.boatYaw -= axis.x * dt * 1.7;
      const accel = axis.z < 0 ? 7.5 : axis.z > 0 ? -4 : -1.8;
      this.boatSpeed = THREE.MathUtils.clamp(this.boatSpeed + accel * dt, -2, 11);
      this.sailAmount = THREE.MathUtils.damp(this.sailAmount, THREE.MathUtils.clamp(Math.abs(this.boatSpeed) / 9, 0.22, 1), 4, dt);
      const polar = this.sailPolar();
      const fx = Math.sin(this.boatYaw);
      const fz = Math.cos(this.boatYaw);
      const nx = this.boat.group.position.x + fx * this.boatSpeed * dt;
      const nz = this.boat.group.position.z + fz * this.boatSpeed * dt;
      const bowX = nx + fx * 1.55;
      const bowZ = nz + fz * 1.55;
      if (isLand(nx, nz) || isLand(bowX, bowZ) || isLand(nx - fx * 1.1, nz - fz * 1.1)) {
        this.boatSpeed *= 0.35;
        const safe = pushToWater(this.boat.group.position.x, this.boat.group.position.z);
        this.boat.group.position.x = safe.x;
        this.boat.group.position.z = safe.z;
      } else {
        this.boat.group.position.x = nx;
        this.boat.group.position.z = nz;
      }
      this.floatBoat();
      const heel = Math.sin(this.angDelta(this.windYaw, this.boatYaw)) * this.sailAmount * 0.08;
      this.boat.group.rotation.y = this.boatYaw;
      this.boat.group.rotation.z = Math.sin(this.elapsed * 1.4) * 0.04 + heel;
      this.boat.group.rotation.x = Math.cos(this.elapsed * 1.1) * 0.035;
      this.boat.update(this.elapsed, this.boatSpeed, this.sailAmount, this.windYaw, this.boatYaw, polar);
      this.eva.group.position.set(this.boat.group.position.x, this.boat.group.position.y + 0.62, this.boat.group.position.z);
      this.eva.group.rotation.y = this.boatYaw;
      this.grounded = true;
      this.evaVy = 0;
      this.floating = false;
      this.mooringRope.visible = false;
      this.mooringStake.visible = false;
    } else {
      this.walk(dt, true);
      this.applyHop(dt, true);
      this.floatBoat();
      this.boat.update(this.elapsed, 0.2, 0.18, this.windYaw, this.boatYaw, 0.3);
      this.updateMooring();
    }

    const isl = nearestIsland(this.eva.group.position.x, this.eva.group.position.z);
    if (isl && !this.save.discovered.includes(isl.id)) {
      this.save.discovered.push(isl.id);
      if (!new URLSearchParams(location.search).get("shot")) {
        this.toast(isl.discovery);
        this.audio.chime("rare");
      }
    }
  }

  private walk(dt: number, onWorld: boolean) {
    const axis = this.input.moveAxis();
    if (!axis.x && !axis.z) {
      this.turnRate = THREE.MathUtils.damp(this.turnRate, 0, 8, dt);
      return;
    }
    const speed = this.floating ? 6.6 : this.grounded ? 4.8 : 5.2;
    this.moveFwd.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    this.moveRight.crossVectors(this.moveFwd, this.moveUp).normalize();
    const mx = (this.moveRight.x * axis.x + this.moveFwd.x * -axis.z) * speed * dt;
    const mz = (this.moveRight.z * axis.x + this.moveFwd.z * -axis.z) * speed * dt;
    const ox = this.eva.group.position.x;
    const oz = this.eva.group.position.z;
    const nx = ox + mx;
    const nz = oz + mz;
    if (onWorld) {
      this.tryStep(nx, nz);
    } else if (this.currentInterior) {
      const f = this.currentInterior.floor;
      this.eva.group.position.x = THREE.MathUtils.clamp(nx, f.minX, f.maxX);
      this.eva.group.position.z = THREE.MathUtils.clamp(nz, f.minZ, f.maxZ);
    }
    const ax = this.eva.group.position.x - ox;
    const az = this.eva.group.position.z - oz;
    if (Math.hypot(ax, az) < 1e-5) {
      this.turnRate = THREE.MathUtils.damp(this.turnRate, 0, 8, dt);
      return;
    }
    const yaw = Math.atan2(ax, az);
    let d = yaw - this.lastYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.turnRate = d / Math.max(dt, 0.0001);
    this.lastYaw = yaw;
    this.eva.group.rotation.y = yaw;
  }

  private tryStep(nx: number, nz: number) {
    if (this.canStand(nx, nz)) {
      this.eva.group.position.x = nx;
      this.eva.group.position.z = nz;
      return;
    }
    const x = this.eva.group.position.x;
    const z = this.eva.group.position.z;
    if (this.canStand(nx, z)) this.eva.group.position.x = nx;
    else if (this.canStand(x, nz)) this.eva.group.position.z = nz;
  }

  private canStand(x: number, z: number, ignoreStep = false) {
    if (this.blocked(x, z)) return false;
    const h = heightAt(x, z);
    if (h < 0.08) return false;
    if (!ignoreStep && this.grounded && h - this.eva.group.position.y > 1.15) return false;
    return true;
  }

  private applyHop(dt: number, onWorld: boolean) {
    if (this.sailing) return;
    const p = this.eva.group.position;
    const ground = onWorld ? heightAt(p.x, p.z) : 0;
    if (this.input.consume("Space") && this.grounded) {
      this.evaVy = onWorld ? 11.4 : 6.8;
      this.grounded = false;
    }
    this.floating = this.input.pressed("Space") && !this.grounded;
    if (!this.grounded) {
      if (this.floating) {
        this.evaVy -= 3.1 * dt;
        this.evaVy += Math.sin(this.elapsed * 14) * 3.4 * dt;
        if (this.evaVy > 3.6) this.evaVy = 3.6;
        this.evaVy = Math.max(this.evaVy, -0.48);
      } else {
        this.evaVy -= 18 * dt;
      }
      p.y += this.evaVy * dt;
      const ceiling = onWorld ? ground + 16 : 2.85;
      if (p.y > ceiling) {
        p.y = ceiling;
        this.evaVy = Math.min(this.evaVy, 0);
      }
      if (p.y <= ground) {
        p.y = ground;
        this.evaVy = 0;
        this.grounded = true;
        this.floating = false;
      }
    } else {
      p.y = ground;
      this.evaVy = 0;
      this.floating = false;
    }
  }

  private blocked(x: number, z: number) {
    const hit = this.colliders.find((c) => Math.hypot(x - c.x, z - c.z) < c.r);
    if (!hit) return false;
    const p = this.eva.group.position;
    const insideNow = Math.hypot(p.x - hit.x, p.z - hit.z) < hit.r;
    if (insideNow) {
      return Math.hypot(x - hit.x, z - hit.z) <= Math.hypot(p.x - hit.x, p.z - hit.z) + 0.002;
    }
    return true;
  }

  private updateInterior(dt: number) {
    this.sailing = false;
    this.walk(dt, false);
    this.applyHop(dt, false);
    const night = this.isNight();
    this.currentInterior?.group.traverse((o) => {
      if (o.name === "interior-npc") o.visible = night || true;
    });
    this.currentInterior?.shelfAnchors.forEach((a) => {
      a.children.forEach((ch) => (ch.rotation.y = this.elapsed * 0.4));
    });
    if (this.input.consume("KeyQ") && this.currentInterior?.id === "home") {
      this.decorate = !this.decorate;
      this.toast(this.decorate ? "Decorating — open your bag and tap a decor piece." : "Done fussing with the furniture.");
    }
  }

  private updateCamera(dt: number, snap = false) {
    const inside = !!this.currentInterior;
    const targetFov = this.spyglass ? 26 : inside ? 50 : this.sailing ? 50 : 48;
    this.fov = snap ? targetFov : THREE.MathUtils.lerp(this.fov, targetFov, 1 - Math.pow(0.01, dt));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const dist = inside
      ? THREE.MathUtils.clamp(this.camDist, 2.1, 5.4)
      : this.sailing
        ? this.camDist + 3
        : this.camDist;
    const pitch = inside ? THREE.MathUtils.clamp(this.camPitch, 0.16, 1.05) : this.camPitch;
    const t = this.eva.group.position;
    const lookY = inside ? 0.92 : 1.15;
    const look = new THREE.Vector3(t.x, t.y + lookY, t.z);
    const ox = Math.sin(this.camYaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist;
    const oz = Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(look.x - ox, look.y + oy, look.z - oz);
    if (inside) this.keepCamInRoom(desired, look);
    const follow = snap ? 1 : inside ? 1 - Math.pow(0.0007, dt) : 1 - Math.pow(0.02, dt);
    if (snap) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, follow);
    if (inside) this.keepCamInRoom(this.camera.position, look);
    this.camera.lookAt(look);
    this.sky.dir.target.position.copy(t);
    this.sky.dir.target.updateMatrixWorld();
    this.sky.dir.position.copy(t).add(this.sky.sunDir.clone().multiplyScalar(70));
  }

  private keepCamInRoom(p: THREE.Vector3, look: THREE.Vector3) {
    const f = this.currentInterior?.floor;
    if (!f) return;
    const pad = 0.42;
    const ok = (q: THREE.Vector3) =>
      q.x >= f.minX + pad && q.x <= f.maxX - pad && q.z >= f.minZ + pad && q.z <= f.maxZ - pad && q.y >= 0.95 && q.y <= 3.55;
    p.y = THREE.MathUtils.clamp(p.y, 1.05, 3.5);
    if (ok(p)) return;
    for (let i = 0; i < 12; i++) {
      p.lerp(look, 0.14);
      p.y = THREE.MathUtils.clamp(p.y, 1.05, 3.5);
      if (ok(p)) return;
    }
    p.x = THREE.MathUtils.clamp(p.x, f.minX + pad, f.maxX - pad);
    p.z = THREE.MathUtils.clamp(p.z, f.minZ + pad, f.maxZ - pad);
    p.y = THREE.MathUtils.clamp(p.y, 1.05, 3.5);
  }

  private updateWind(dt: number) {
    this.windYaw += Math.sin(this.elapsed * 0.031) * 0.14 * dt;
    this.windSpeed = 6.2 + Math.sin(this.elapsed * 0.041) * 1.2;
  }

  private callWind() {
    if (!this.sailing) return;
    this.windYaw = this.boatYaw;
    this.audio.chime("ui");
    this.toast("The wind swings to your bow.");
  }

  private windVec() {
    return { x: Math.sin(this.windYaw), z: Math.cos(this.windYaw) };
  }

  private angDelta(a: number, b: number) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private sailPolar() {
    const angle = Math.abs(this.angDelta(this.boatYaw, this.windYaw));
    if (angle < 0.42) return 0.78;
    if (angle < 1.15) return 1;
    if (angle < 1.85) return 0.62;
    if (angle < 2.35) return 0.22;
    return 0.08;
  }

  private windLabel() {
    const a = Math.abs(this.angDelta(this.boatYaw, this.windYaw));
    if (a < 0.5) return "tailwind";
    if (a < 1.2) return "reaching";
    if (a < 1.9) return "close";
    return "luffing";
  }

  private windArrow() {
    const ref = this.sailing ? this.boatYaw : this.camYaw;
    const d = this.angDelta(this.windYaw, ref);
    const step = Math.round(((d + Math.PI) / (Math.PI * 2)) * 8) % 8;
    return ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][step] ?? "↑";
  }

  private gatherPrompt() {
    this.interact = null;
    this.prompt = "";
    const p = this.eva.group.position;

    if (this.currentInterior) {
      let best = 2.2;
      for (const it of this.currentInterior.interacts) {
        const d = Math.hypot(p.x - it.position.x, p.z - it.position.z);
        if (d < best) {
          best = d;
          this.prompt = `E — ${it.label}`;
          this.interact = () => this.doInterior(it.kind);
        }
      }
      if (this.decorate) {
        for (const ch of this.currentInterior.decorRoot.children) {
          const d = Math.hypot(p.x - ch.position.x, p.z - ch.position.z);
          if (d < 1.4) {
            this.prompt = "E — Pick up decoration";
            this.interact = () => this.pickupDecor(ch);
          }
        }
      }
      this.showPrompt();
      return;
    }

    const pickup = this.collect.nearest(p.x, p.z, this.spyglass ? 6 : 2.3);

    const consider = (label: string, fn: () => void) => {
      if (this.interact) return;
      this.prompt = label;
      this.interact = fn;
    };

    if (this.sailing) {
      const isl = nearestIsland(this.boat.group.position.x, this.boat.group.position.z);
      if (isl && Math.hypot(this.boat.group.position.x - isl.x, this.boat.group.position.z - isl.z) < isl.radius + 6) {
        consider(`E — Dock at ${isl.name}`, () => this.dock(isl.id));
      }
    }

    if (pickup) {
      const def = ITEMS[pickup.item];
      consider(`E — Pick up ${def.name}`, () => this.takePickup(pickup.id));
    }

    this.npcs.forEach((mesh, id) => {
      if (!mesh.visible) return;
      if (mesh.position.distanceTo(p) < 2.6) {
        consider(`E — Talk to ${NPCS[id].name}`, () => this.openDialogue(id));
      }
    });

    for (const h of this.houses) {
      const door = this.doorWorld(h);
      if (Math.hypot(p.x - door.x, p.z - door.z) < 2.3) {
        consider(`E — Enter ${this.houseLabel(h.kind)}`, () => this.enterHouse(h));
      }
    }

    const boatD = Math.hypot(p.x - this.boat.group.position.x, p.z - this.boat.group.position.z);
    if (!this.sailing && boatD < 4.2) {
      consider("E — Board the red boat", () => {
        this.sailing = true;
        this.sailAmount = 0.55;
        this.boatSpeed = 0;
        this.camYaw = this.boatYaw;
        this.camPitch = 0.3;
        this.camDist = Math.max(this.camDist, 13);
        this.updateCamera(1, true);
        this.audio.chime("ui");
        if (!this.sailedHint) {
          this.sailedHint = true;
          this.toast("W and S to go. Tap Compass to call the wind to your bow.");
        }
      });
    }

    if (this.spyglass && pickup) {
      this.prompt = `${ITEMS[pickup.item].name} · ${ITEMS[pickup.item].rarity}`;
    }
    this.showPrompt();
  }

  private showPrompt() {
    const el = $("hud-prompt");
    el.classList.toggle("hidden", !this.prompt);
    el.textContent = this.prompt;
  }

  private doorWorld(h: HouseAnchor) {
    const depth = h.kind === "home" ? 3.75 : h.kind === "coral" ? 1.95 : h.kind === "mallow" ? 2.4 : 2.2;
    const o = houseWorldOffset(h, 0, depth);
    return new THREE.Vector3(o.x, 0, o.z);
  }

  private houseLabel(k: HouseKind) {
    return {
      home: "Eva's cottage",
      mallow: "Mallow's wool house",
      pebble: "Pebble's library",
      coral: "Coral's stall-home",
      brine: "Captain Brine's boathouse",
    }[k];
  }

  private enterHouse(h: HouseAnchor) {
    const room = this.interiors.get(h.kind);
    if (!room) return;
    this.houseInside = h;
    this.exitPos.copy(this.doorWorld(h));
    this.exitPos.y = heightAt(this.exitPos.x, this.exitPos.z);
    this.currentInterior = room;
    this.interiorScene.clear();
    this.interiorScene.add(room.group);
    this.interiorScene.add(this.eva.group);
    this.eva.group.position.copy(room.spawn);
    this.eva.group.rotation.y = Math.PI;
    this.sailing = false;
    this.grounded = true;
    this.evaVy = 0;
    this.floating = false;
    this.mooringRope.visible = false;
    this.mooringStake.visible = false;
    if (h.kind === "home") {
      fillShelf(room, this.save.displayed);
      rebuildDecor(room, this.save.decorations);
    }
    this.renderPass.scene = this.interiorScene;
    this.worldCam = { yaw: this.camYaw, pitch: this.camPitch, dist: this.camDist };
    this.camDist = 3.15;
    this.camPitch = 0.42;
    this.camYaw = 0;
    this.setState("interior");
    this.updateCamera(1, true);
    this.audio.chime("ui");
  }

  private leaveHouse() {
    if (!this.currentInterior) return;
    this.world.add(this.eva.group);
    const h = this.houseInside;
    if (h) {
      const o = this.outdoorStand(h);
      this.eva.group.position.set(o.x, heightAt(o.x, o.z), o.z);
      this.eva.group.rotation.y = h.yaw;
    } else {
      this.eva.group.position.copy(this.exitPos);
      this.eva.group.position.y = heightAt(this.exitPos.x, this.exitPos.z);
    }
    this.grounded = true;
    this.evaVy = 0;
    this.floating = false;
    this.currentInterior = null;
    this.houseInside = null;
    this.renderPass.scene = this.world;
    this.decorate = false;
    this.camYaw = this.worldCam.yaw;
    this.camPitch = this.worldCam.pitch;
    this.camDist = this.worldCam.dist;
    this.setState("world");
    this.updateCamera(1, true);
  }

  private outdoorStand(h: HouseAnchor) {
    const depths = h.kind === "home" ? [6.6, 7.4, 5.8, 8.2, 4.8] : [4.4, 5.2, 3.7, 6.0];
    const sides = [0, 0.9, -0.9, 1.6, -1.6];
    for (const dist of depths) {
      for (const side of sides) {
        const o = houseWorldOffset(h, side, dist);
        if (!this.canStand(o.x, o.z, true)) continue;
        return o;
      }
    }
    return houseWorldOffset(h, 0, h.kind === "home" ? 6.6 : 4.4);
  }

  private doInterior(kind: InteriorRoom["interacts"][number]["kind"]) {
    if (kind.type === "exit") this.leaveHouse();
    if (kind.type === "sleep") this.sleep();
    if (kind.type === "shelf") this.openShelf(kind.index);
    if (kind.type === "npc") this.openDialogue(kind.id);
  }

  private openShelf(index: number) {
    this.shelfIndex = index;
    this.setState("shelf");
    const grid = $("shelf-grid");
    grid.innerHTML = "";
    const finds = Object.entries(this.save.items).filter(([id, n]) => n > 0 && (ITEMS[id]?.kind === "shell" || ITEMS[id]?.kind === "rock"));
    const clear = document.createElement("button");
    clear.className = "inv-item";
    clear.innerHTML = `<div class="name">Clear this nook</div>`;
    clear.onclick = () => this.placeOnShelf(null);
    grid.append(clear);
    for (const [id, n] of finds) {
      const def = ITEMS[id];
      const el = document.createElement("button");
      el.className = "inv-item";
      el.innerHTML = `<div class="name">${def.name}</div><div class="qty">${def.rarity} · ×${n}</div>`;
      el.onclick = () => this.placeOnShelf(id);
      grid.append(el);
    }
  }

  private placeOnShelf(id: string | null) {
    this.save.displayed[this.shelfIndex] = id;
    if (this.currentInterior) fillShelf(this.currentInterior, this.save.displayed);
    this.setState("interior");
    this.audio.chime("ui");
  }

  private pickupDecor(obj: THREE.Object3D) {
    const id = obj.name || (obj.children[0] as THREE.Object3D | undefined)?.parent?.userData?.id;
    const match = this.save.decorations.find((d) => Math.hypot(d.x - obj.position.x, d.z - obj.position.z) < 0.2);
    if (match) {
      this.save.items[match.id] = (this.save.items[match.id] ?? 0) + 1;
      this.save.decorations = this.save.decorations.filter((d) => d !== match);
      if (this.currentInterior) rebuildDecor(this.currentInterior, this.save.decorations);
    }
    void id;
  }

  private placeDecor(id: string) {
    if (!this.currentInterior || this.currentInterior.id !== "home") {
      this.toast("Decor belongs back at Eva's cottage.");
      return;
    }
    if ((this.save.items[id] ?? 0) <= 0) return;
    this.save.items[id]--;
    const f = this.eva.group.rotation.y;
    const x = this.eva.group.position.x + Math.sin(f) * 1.2;
    const z = this.eva.group.position.z + Math.cos(f) * 1.2;
    this.save.decorations.push({ id, x, z, rot: f });
    rebuildDecor(this.currentInterior, this.save.decorations);
    this.setState("interior");
    this.audio.chime("ui");
  }

  private dock(islandId: string) {
    const isl = ISLANDS.find((i) => i.id === islandId)!;
    const beach = beachPoint(isl, this.boat.group.position.x, this.boat.group.position.z);
    this.moorAt(isl);
    this.sailing = false;
    this.boatSpeed = 0;
    this.eva.group.position.set(beach.x, beach.y, beach.z);
    this.grounded = true;
    this.evaVy = 0;
    this.audio.chime("ui");
  }

  private moorAt(isl: ReturnType<typeof nearestIsland> | (typeof ISLANDS)[number]) {
    if (!isl) return;
    const ang = PIER_ANG[isl.id];
    const berth = ang != null ? pierBerth(isl, ang) : berthPoint(isl, this.eva.group.position.x, this.eva.group.position.z);
    this.boat.group.position.set(berth.x, 0.16, berth.z);
    this.boatYaw = Math.atan2(berth.x - isl.x, berth.z - isl.z);
    this.boat.group.rotation.y = this.boatYaw;
    this.floatBoat();
  }

  private updateMooring() {
    if (this.sailing || this.currentInterior) {
      this.mooringRope.visible = false;
      this.mooringStake.visible = false;
      return;
    }
    const isl = nearestIsland(this.boat.group.position.x, this.boat.group.position.z);
    if (!isl) {
      this.mooringRope.visible = false;
      this.mooringStake.visible = false;
      return;
    }
    const ang = PIER_ANG[isl.id];
    let cleat: THREE.Vector3;
    if (ang != null) {
      cleat = pierCleat(isl, ang);
      this.mooringStake.visible = false;
    } else {
      const beach = beachPoint(isl, this.boat.group.position.x, this.boat.group.position.z);
      this.mooringStake.position.set(beach.x, beach.y + 0.32, beach.z);
      this.mooringStake.visible = true;
      cleat = this.mooringStake.position.clone();
      cleat.y += 0.2;
    }
    const fx = Math.sin(this.boatYaw);
    const fz = Math.cos(this.boatYaw);
    const bow = new THREE.Vector3(
      this.boat.group.position.x + fx * 1.45,
      this.boat.group.position.y + 0.42,
      this.boat.group.position.z + fz * 1.45,
    );
    this.ropeDir.subVectors(bow, cleat);
    const len = this.ropeDir.length();
    if (len < 0.2) {
      this.mooringRope.visible = false;
      return;
    }
    this.mooringRope.visible = true;
    this.mooringRope.scale.set(1, len, 1);
    this.mooringRope.position.lerpVectors(cleat, bow, 0.5);
    this.mooringRope.position.y -= 0.12;
    this.mooringRope.quaternion.setFromUnitVectors(this.ropeUp, this.ropeDir.normalize());
  }

  private settleBoat() {
    const p = this.boat.group.position;
    if (!isLand(p.x, p.z)) return;
    const safe = pushToWater(p.x, p.z);
    p.x = safe.x;
    p.z = safe.z;
  }

  private floatBoat() {
    this.settleBoat();
    const p = this.boat.group.position;
    p.y = this.ocean.height(p.x, p.z, this.elapsed) + 0.14;
  }

  private takePickup(id: string) {
    const p = this.collect.pickups.find((x) => x.id === id);
    if (!p || p.taken) return;
    this.collect.take(p);
    this.save.collected.push(p.id);
    this.save.items[p.item] = (this.save.items[p.item] ?? 0) + 1;
    const def = ITEMS[p.item];
    this.audio.chime(def.rarity);
    this.eva.playPickup(def.rarity);
    this.flyLoot.push({
      mesh: p.mesh,
      origin: p.mesh.position.clone(),
      t: 0,
      rarity: def.rarity,
      color: def.glow ?? def.color,
    });
    this.burstSparkles(p.mesh.position, def.rarity, def.glow ?? def.color);
    const toast =
      def.rarity === "legendary"
        ? `A legend — ${def.name}!`
        : def.rarity === "rare"
          ? `Oh! ${def.name}!`
          : def.rarity === "uncommon"
            ? `Found ${def.name}!`
            : `Picked up ${def.name}`;
    this.toast(toast, "found");
  }

  private updateLootFly(dt: number) {
    const eva = this.eva.group;
    const fwd = new THREE.Vector3(Math.sin(eva.rotation.y), 0, Math.cos(eva.rotation.y));
    for (let i = this.flyLoot.length - 1; i >= 0; i--) {
      const f = this.flyLoot[i];
      f.t += dt;
      const dur = f.rarity === "legendary" ? 1.08 : f.rarity === "rare" ? 0.86 : f.rarity === "uncommon" ? 0.6 : 0.42;
      const u = Math.min(1, f.t / dur);
      const hands = eva.position.clone().add(fwd.clone().multiplyScalar(0.42));
      hands.y += f.rarity === "legendary" || f.rarity === "rare" ? 0.95 : 0.55;
      const bag = eva.position.clone();
      bag.y += 0.42;
      if (f.rarity === "rare" || f.rarity === "legendary") {
        if (u < 0.42) {
          const e = 1 - Math.pow(1 - u / 0.42, 3);
          f.mesh.position.lerpVectors(f.origin, hands, e);
          f.mesh.position.y += Math.sin(e * Math.PI) * (f.rarity === "legendary" ? 1.15 : 0.7);
          f.mesh.scale.setScalar(1 + e * (f.rarity === "legendary" ? 0.45 : 0.22));
        } else if (u < 0.72) {
          const spin = (u - 0.42) / 0.3;
          f.mesh.position.copy(hands);
          f.mesh.position.y += Math.sin(this.elapsed * 8) * 0.04;
          f.mesh.scale.setScalar(1.15 + Math.sin(spin * Math.PI) * 0.12);
          if (f.rarity === "legendary") f.mesh.rotation.z = Math.sin(this.elapsed * 6) * 0.25;
        } else {
          const e = (u - 0.72) / 0.28;
          f.mesh.position.lerpVectors(hands, bag, e);
          f.mesh.scale.setScalar((1.2) * (1 - e * 0.95));
        }
        f.mesh.rotation.y += dt * (f.rarity === "legendary" ? 14 : 9);
      } else {
        const e = 1 - Math.pow(1 - u, 3);
        const peak = f.rarity === "uncommon" ? 1.05 : 0.7;
        f.mesh.position.lerpVectors(f.origin, bag, e);
        f.mesh.position.y += Math.sin(u * Math.PI) * peak;
        f.mesh.scale.setScalar(1 - e * 0.9);
        f.mesh.rotation.y += dt * (f.rarity === "uncommon" ? 12 : 8);
        if (f.rarity === "uncommon") f.mesh.rotation.z = Math.sin(u * Math.PI * 2) * 0.4;
      }
      if (u >= 1) {
        f.mesh.visible = false;
        f.mesh.scale.setScalar(1);
        f.mesh.rotation.set(0, 0, 0);
        this.flyLoot.splice(i, 1);
      }
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.life -= dt;
      s.sprite.position.y += dt * 0.9;
      s.sprite.scale.multiplyScalar(1 + dt * 1.4);
      const mat = s.sprite.material;
      mat.opacity = Math.max(0, s.life / 0.55);
      if (s.life <= 0) {
        s.sprite.parent?.remove(s.sprite);
        this.sparkles.splice(i, 1);
      }
    }
  }

  private burstSparkles(at: THREE.Vector3, rarity: Rarity = "common", color = 0xfff1a8) {
    const n = rarity === "legendary" ? 28 : rarity === "rare" ? 18 : rarity === "uncommon" ? 12 : 7;
    const size = rarity === "legendary" ? 0.7 : rarity === "rare" ? 0.55 : 0.42;
    for (let i = 0; i < n; i++) {
      const sprite = glowSprite(i % 3 === 0 ? 0xfff1a8 : color, size);
      const spread = rarity === "legendary" ? 0.85 : 0.45;
      sprite.position.set(at.x + (Math.random() - 0.5) * spread, at.y + 0.2, at.z + (Math.random() - 0.5) * spread);
      this.world.add(sprite);
      this.sparkles.push({ sprite, life: 0.4 + Math.random() * 0.35 + (rarity === "legendary" ? 0.35 : 0) });
    }
  }

  private openInspect(itemId: string) {
    const def = ITEMS[itemId];
    $("inspect-name").textContent = def.name;
    $("inspect-desc").textContent = def.description;
    $("inspect-rarity").textContent = def.rarity;
    $("inspect-rarity").className = `rarity ${def.rarity}`;
    this.inspect.show(itemId);
    this.setState("inspect");
  }

  private renderInventory() {
    const grid = $("inv-grid");
    grid.innerHTML = "";
    const entries = Object.entries(this.save.items).filter(([id, n]) => {
      if (n <= 0 || !ITEMS[id]) return false;
      const k = ITEMS[id].kind;
      return this.invTab === "decor" ? k === "decor" : k === "shell" || k === "rock";
    });
    if (!entries.length) {
      grid.innerHTML = `<p class="muted">Nothing here yet — the islands are full of secrets.</p>`;
      return;
    }
    for (const [id, n] of entries) {
      const def = ITEMS[id];
      const el = document.createElement("button");
      el.className = "inv-item";
      el.innerHTML = `<div class="name">${def.name}</div><div class="qty">${def.rarity} · ×${n}</div>`;
      el.onclick = () => {
        if (this.invTab === "decor" && this.currentInterior?.id === "home") this.placeDecor(id);
        else this.openInspect(id);
      };
      grid.append(el);
    }
  }

  private openDialogue(id: NpcId) {
    this.talkingTo = id;
    this.dialogueMode = "main";
    this.setState("dialogue");
    const npc = NPCS[id];
    $("dlg-name").textContent = `${npc.name} · ${npc.species}`;
    $("dlg-portrait").style.background = `#${npc.color.toString(16).padStart(6, "0")}`;
    $("dlg-text").textContent = this.isNight() ? npc.nightLine : npc.greeting[Math.floor(Math.random() * npc.greeting.length)];
    this.drawChoices([
      { label: "Chat a while", fn: () => this.say(npc.chat[Math.floor(Math.random() * npc.chat.length)]) },
      { label: "Who are you?", fn: () => this.say(npc.personality) },
      { label: "Trade", fn: () => this.showTrades(id) },
      { label: "See you on the tide", fn: () => this.setState(this.currentInterior ? "interior" : "world") },
    ]);
  }

  private say(text: string) {
    $("dlg-text").textContent = text;
    if (!this.talkingTo) return;
    this.drawChoices([{ label: "Back", fn: () => this.openDialogue(this.talkingTo!) }]);
  }

  private showTrades(id: NpcId) {
    this.dialogueMode = "trade";
    const npc = NPCS[id];
    $("dlg-text").textContent = "What shall we swap, then?";
    const choices = npc.trades
      .filter((t) => !(t.once && this.save.tradesDone.includes(t.id)))
      .map((t) => ({
        label: t.label,
        fn: () => this.tryTrade(t),
      }));
    choices.push({ label: "Never mind", fn: () => this.openDialogue(id) });
    this.drawChoices(choices);
  }

  private tryTrade(t: TradeRecipe) {
    const treatCost = t.give.treats && t.give.treats < 0 ? -t.give.treats : 0;
    if (this.save.treats < treatCost) {
      this.say("You'll need a few more treats for that one.");
      return;
    }
    for (const w of t.want) {
      if ((this.save.items[w.item] ?? 0) < w.count) {
        this.say(`Bring ${w.count}× ${ITEMS[w.item].name} and we'll talk.`);
        return;
      }
    }
    for (const w of t.want) this.save.items[w.item] -= w.count;
    if (t.give.item) this.save.items[t.give.item] = (this.save.items[t.give.item] ?? 0) + (t.give.count ?? 1);
    if (t.give.treats) this.save.treats += t.give.treats;
    if (t.once) this.save.tradesDone.push(t.id);
    if (this.talkingTo) this.save.friendship[this.talkingTo] = (this.save.friendship[this.talkingTo] ?? 0) + 1;
    this.audio.chime("uncommon");
    this.say(t.success);
  }

  private drawChoices(choices: { label: string; fn: () => void }[]) {
    const box = $("dlg-choices");
    box.innerHTML = "";
    for (const c of choices) {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.onclick = c.fn;
      box.append(b);
    }
  }

  private sleep() {
    this.setState("sleeping");
    this.save.day += 1;
    this.save.time = 0.3;
    $("sleep-title").textContent = `Day ${this.save.day}`;
    $("sleep-line").textContent = SLEEP_LINES[(this.save.day - 1) % SLEEP_LINES.length];
    this.audio.chime("sleep");
    this.collect.spawn(this.save.collected, this.save.day);
    this.persist();
    setTimeout(() => {
      this.setState("interior");
      this.toast("Morning pours in through the pink windows.");
    }, 2600);
  }

  private onClick() {
    if (this.currentInterior || this.sailing) return;
    this.pointer.set(this.input.clickNdc.x, this.input.clickNdc.y);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.collect.group.children, true);
    if (hits[0]) {
      let o: THREE.Object3D | null = hits[0].object;
      while (o && !o.userData.pickupId) o = o.parent;
      if (o?.userData.pickupId) {
        const p = this.collect.pickups.find((x) => x.id === o!.userData.pickupId);
        if (p && Math.hypot(p.x - this.eva.group.position.x, p.z - this.eva.group.position.z) < 6) this.takePickup(p.id);
      }
    }
  }

  private updateHud() {
    const tod =
      this.save.time < 0.2
        ? "Night"
        : this.save.time < 0.35
          ? "Morning"
          : this.save.time < 0.62
            ? "Noon"
            : this.save.time < 0.78
              ? "Evening"
              : "Night";
    $("hud-day").textContent = `Day ${this.save.day} · ${tod}`;
    const isl = this.currentInterior
      ? this.houseLabel(this.currentInterior.id)
      : (nearestIsland(this.eva.group.position.x, this.eva.group.position.z)?.name ?? "Open sea");
    $("hud-place").textContent = this.sailing ? `${isl} · sailing` : isl;
    $("hud-treats").textContent = `Treats ${this.save.treats}`;
    const wind = $("hud-wind");
    if (wind) {
      wind.classList.toggle("hidden", !this.sailing);
      if (this.sailing) wind.textContent = `Compass ${this.windArrow()} · tap`;
    }
    $("touch-decor").classList.toggle("hidden", this.currentInterior?.id !== "home");
    if (this.bannerT > 0) {
      this.bannerT -= 0.016;
      if (this.bannerT <= 0) $("banner").classList.add("hidden");
    }
  }

  toast(text: string, kind?: "found") {
    const b = $("banner");
    b.textContent = text;
    b.classList.toggle("found", kind === "found");
    b.classList.remove("hidden");
    this.bannerT = kind === "found" ? 2.1 : 3.2;
  }

  private armTouchGo() {
    const go = $("touch-go");
    if (!go) return;
    go.classList.toggle("armed", !!this.interact);
    const p = this.prompt;
    let label = "Go";
    if (/Pick up decoration/i.test(p)) label = "Take";
    else if (/Arrange|treasure/i.test(p)) label = "Place";
    else if (/Pick/i.test(p)) label = "Pick";
    else if (/Dock/i.test(p)) label = "Dock";
    else if (/Board/i.test(p)) label = "Sail";
    else if (/Talk/i.test(p)) label = "Talk";
    else if (/Enter/i.test(p)) label = "In";
    else if (/Leave/i.test(p)) label = "Out";
    else if (/Sleep/i.test(p)) label = "Sleep";
    go.textContent = label;
  }

  private sailName() {
    return "sailing";
  }

  persist() {
    this.save.eva = {
      x: this.eva.group.position.x,
      z: this.eva.group.position.z,
      sailing: this.sailing,
    };
    this.save.boat = {
      x: this.boat.group.position.x,
      z: this.boat.group.position.z,
      yaw: this.boatYaw,
    };
    writeSave(this.save);
  }

  private render() {
    const scene = this.currentInterior ? this.interiorScene : this.world;
    this.renderPass.scene = scene;
    this.bloom.strength = this.currentInterior ? 0.06 : 0.22;
    this.composer.render();
    if (this.state === "inspect") this.inspect.render(this.elapsed);
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.inspect.resize();
  }

  applyShot(name: string) {
    const put = (x: number, z: number, yaw = 0.8, dist = 10, pitch = 0.35) => {
      const y = Math.max(heightAt(x, z), 0.2);
      this.eva.group.position.set(x, y, z);
      this.camYaw = yaw;
      this.camDist = dist;
      this.camPitch = pitch;
      this.sailing = false;
    };
    if (name === "home" || name === "house") {
      const home = this.houses.find((h) => h.kind === "home")!;
      const door = this.doorWorld(home);
      const standX = door.x + Math.sin(home.yaw) * 3.4;
      const standZ = door.z + Math.cos(home.yaw) * 3.4;
      put(standX, standZ, home.yaw + Math.PI, name === "house" ? 13 : 11, 0.3);
    }
    if (name === "eva") {
      const home = this.houses.find((h) => h.kind === "home")!;
      const door = this.doorWorld(home);
      const fx = Math.sin(home.yaw);
      const fz = Math.cos(home.yaw);
      put(door.x + fx * 4.2, door.z + fz * 4.2, home.yaw + Math.PI, 3.6, 0.16);
      this.eva.group.rotation.y = home.yaw;
    }
    if (name === "npc" || name === "talk") {
      const mesh = this.npcs.get("mallow")!;
      put(mesh.position.x + 2.2, mesh.position.z + 1.4, 4.1, 6.5, 0.22);
      this.eva.group.lookAt(mesh.position);
      if (name === "talk") this.openDialogue("mallow");
    }
    if (name === "inspect") {
      this.openInspect("heart_conch");
    }
    if (name === "sea") {
      this.sailing = true;
      this.sailAmount = 0.8;
      this.boat.group.position.set(72, 0.2, 30);
      this.boatYaw = 0.8;
      this.camYaw = 0.8;
      this.camDist = 16;
      this.camPitch = 0.28;
    }
    if (name === "collect") put(14, 166, 0.2, 8, 0.4);
    if (name === "stone") put(124, 64, -0.4, 18, 0.28);
    if (name === "palm") put(108, -96, 0.7, 14, 0.3);
    if (name === "harbor") put(-64, -118, 3.0, 13, 0.32);
    if (name === "sunset") {
      put(10, 12, 1.1, 16, 0.25);
      this.save.time = 0.74;
    }
    if (name === "night") {
      put(6, 8, 0.9, 12, 0.3);
      this.save.time = 0.88;
    }
    if (name === "interior" || name === "shelf") {
      const home = this.houses.find((h) => h.kind === "home")!;
      this.enterHouse(home);
      this.save.displayed[0] = "sunset_scallop";
      this.save.displayed[1] = "starstone";
      this.save.displayed[2] = "heart_conch";
      this.save.items.sunset_scallop = 1;
      this.save.items.starstone = 1;
      this.save.items.heart_conch = 1;
      fillShelf(this.currentInterior!, this.save.displayed);
      this.eva.group.position.set(0, 0, -0.3);
      this.camYaw = 0;
      this.camPitch = 0.4;
      this.camDist = 3.2;
    }
    this.camera.position.set(this.eva.group.position.x + 8, 8, this.eva.group.position.z + 8);
    this.updateCamera(1, true);
  }
}

