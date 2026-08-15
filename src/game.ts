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
import { buildArchipelago, heightAt, nearestIsland, beachPoint, berthPoint, pierBerth, pierCleat, PIER_ANG, houseWorldOffset, pushToWater, isLand, yardPoint } from "./world/islands";
import { CollectibleWorld } from "./world/collectibles";
import { buildInterior, fillShelf, rebuildDecor, fillNpcGift, fillFriendDecor, type InteriorRoom } from "./world/interior";
import { createNpc } from "./models/animals";
import { InspectView } from "./inspect";
import { AudioBed } from "./audio";
import { freshSave, loadSave, writeSave } from "./save";
import { glowSprite, toon } from "./materials";
import { ITEMS, ISLANDS, NPCS, SLEEP_LINES } from "./catalog";
import { INTRO, bumpTalk, friendPips, friendTier, greetingFor, hasChart, questOpen } from "./progress";
import { itemIcon, npcPortrait } from "./portraits";
import { createItemVisual } from "./models/items";
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
  private giftTarget: NpcId | "yard" | null = null;
  private yardVis: THREE.Group | null = null;
  private portraits = new Map<NpcId, string>();

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
    $("btn-close-shelf").onclick = () => {
      const back = this.giftTarget === "yard" ? "world" : "interior";
      this.giftTarget = null;
      this.restoreShelfLabels();
      this.setState(back);
    };
    $("btn-close-chart").onclick = () => this.setState(this.currentInterior ? "interior" : "world");
    $("btn-chart").onclick = () => this.openChart();
    $("vol-slider").oninput = () => {
      const v = Number(($("vol-slider") as HTMLInputElement).value) / 100;
      this.save.volume = v;
      this.audio.setVolume(v);
      this.persist();
    };
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
    this.audio.setVolume(this.save.volume);
    const slider = $("vol-slider") as HTMLInputElement | null;
    if (slider) slider.value = String(Math.round(this.save.volume * 100));
    this.refreshYard();
    this.parkVisitor();
    this.setState("world");
    this.audio.resume();
    $("title-screen").classList.add("hidden");
    $("hud").classList.remove("hidden");
    if (!new URLSearchParams(location.search).get("shot")) {
      if (!fromSave && this.save.introBeat <= INTRO.wake) {
        this.toast("The beach left you a little white shell. The sea is already waving.");
      } else {
        this.toast(fromSave ? "Welcome back, little admiral." : "A new day begins on the high seas.");
      }
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
    $("shelf-picker").classList.toggle("hidden", s !== "shelf" && s !== "gift");
    $("sleep-overlay").classList.toggle("hidden", s !== "sleeping");
    $("chart-screen").classList.toggle("hidden", s !== "chart");
    $("touch-hud").classList.toggle("hidden", s !== "world" && s !== "interior");
    const chartBtn = $("btn-chart");
    if (chartBtn) chartBtn.hidden = !hasChart(this.save);
    if (s === "title") this.refreshContinue();
    if (s !== "inspect") this.inspect.hide();
    if (s === "chart") this.drawChart();
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
      this.ocean.update(this.elapsed, this.sky.sunDir, this.sky.night);
      const bob = Math.sin(this.elapsed * 0.22) * 1.4;
      this.camera.position.set(26 + bob, 11.5, 34);
      this.camera.lookAt(-6, 2.4, -8);
      this.camera.fov = 46;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.input.consume("Escape")) {
      if (this.state === "inspect") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "inventory" || this.state === "shelf" || this.state === "gift") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "dialogue") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "chart") this.setState(this.currentInterior ? "interior" : "world");
      else if (this.state === "paused") this.setState(this.currentInterior ? "interior" : "world");
      else this.setState("paused");
    }
    if (this.input.consume("KeyM") && hasChart(this.save) && (this.state === "world" || this.state === "interior" || this.state === "paused")) {
      this.openChart();
      return;
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
    if (this.state === "inventory" || this.state === "shelf" || this.state === "gift" || this.state === "chart") return;

    const playable = this.state === "world" || this.state === "interior" || this.state === "dialogue";
    if (!playable) return;

    if (this.state !== "dialogue") {
      this.save.time = (this.save.time + dt * 0.0035) % 1;
      this.sky.update(this.save.time, dt);
      const fog = this.world.fog as THREE.FogExp2;
      fog.color.copy(this.sky.material.uniforms.uHorizon.value);
      if (this.save.morningFog && this.save.time > 0.45) this.save.morningFog = false;
      fog.density = this.save.morningFog ? 0.011 : 0.0042;
      this.ocean.update(this.elapsed, this.sky.sunDir, this.sky.night);
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
    if (!inside) {
      this.camYaw -= mouse.x * (touchLook ? 0.0076 : 0.005);
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + mouse.y * (touchLook ? 0.0062 : 0.004), 0.1, 1.15);
      this.camDist = THREE.MathUtils.clamp(this.camDist + this.input.consumeWheel() * 0.01, 5, 22);
    } else {
      this.input.consumeWheel();
    }

    this.spyglass = this.input.pressed("KeyF") && !this.currentInterior;
    $("spyglass-rim").classList.toggle("hidden", !this.spyglass);

    if (this.currentInterior) this.updateInterior(dt);
    else this.updateWorld(dt);

    const sprinting = this.isSprinting();
    this.eva.update(dt, this.isMoving(), this.sailing, this.spyglass, this.turnRate, !this.grounded && !this.sailing, this.floating, sprinting);
    this.audio.footsteps(dt, this.isMoving() && !this.sailing, this.grounded, sprinting);
    const here = nearestIsland(this.eva.group.position.x, this.eva.group.position.z);
    this.audio.setAmbience({
      indoors: !!this.currentInterior,
      island: here?.id ?? "sea",
      night: this.isNight(),
      sailing: this.sailing,
    });
    this.updatePorchLamps();
    this.maybeLookoutHint();
    this.maybeVisitorGoHome();
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
    if (this.save.morningEvent === "squall") this.windSpeed += 2.4;

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
      // Tailwind is a bonus, never a gate — W/S always move the boat.
      const windMul = 1 + Math.cos(this.angDelta(this.boatYaw, this.windYaw)) * 0.2;
      const nx = this.boat.group.position.x + fx * this.boatSpeed * windMul * dt;
      const nz = this.boat.group.position.z + fz * this.boatSpeed * windMul * dt;
      const bowX = nx + fx * 2.35;
      const bowZ = nz + fz * 2.35;
      if (isLand(nx, nz) || isLand(bowX, bowZ) || isLand(nx - fx * 1.35, nz - fz * 1.35)) {
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
      this.eva.group.position.set(
        this.boat.group.position.x + fx * 1.05,
        this.boat.group.position.y + 0.68,
        this.boat.group.position.z + fz * 1.05,
      );
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
      this.persist();
    }
  }

  private isSprinting() {
    return !this.sailing && !this.floating && this.grounded && (this.input.pressed("ShiftLeft") || this.input.pressed("ShiftRight"));
  }

  private walk(dt: number, onWorld: boolean) {
    const axis = this.input.moveAxis();
    if (!axis.x && !axis.z) {
      this.turnRate = THREE.MathUtils.damp(this.turnRate, 0, 8, dt);
      return;
    }
    const sprint = this.isSprinting();
    const speed = this.floating ? 6.6 : this.grounded ? (sprint ? 8.4 : 4.8) : 5.2;
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
      const px = THREE.MathUtils.clamp(nx, f.minX, f.maxX);
      const pz = THREE.MathUtils.clamp(nz, f.minZ, f.maxZ);
      if (!this.blockedInterior(px, pz)) {
        this.eva.group.position.x = px;
        this.eva.group.position.z = pz;
      } else if (!this.blockedInterior(px, oz)) this.eva.group.position.x = px;
      else if (!this.blockedInterior(ox, pz)) this.eva.group.position.z = pz;
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
      this.audio.foley("hop");
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

  private blockedInterior(x: number, z: number) {
    const room = this.currentInterior;
    if (!room) return false;
    const rad = 0.52;
    return room.blockers.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + rad);
  }

  private updateInterior(dt: number) {
    this.sailing = false;
    this.walk(dt, false);
    this.applyHop(dt, false);
    this.currentInterior?.group.traverse((o) => {
      if (o.name === "interior-npc") o.visible = true;
    });
    this.currentInterior?.shelfAnchors.forEach((a) => {
      a.children.forEach((ch) => (ch.rotation.y = this.elapsed * 0.4));
    });
    if (this.input.consume("KeyQ") && this.currentInterior?.id === "home") {
      this.decorate = !this.decorate;
      this.toast(this.decorate ? "Decorating — bag to place, E to pick up, R to turn." : "Done fussing with the furniture.");
    }
    if (this.decorate && this.input.consume("KeyR")) this.rotateNearestDecor();
  }

  private updateCamera(dt: number, snap = false) {
    if (this.currentInterior) {
      this.applyInteriorCamera();
      return;
    }
    const targetFov = this.spyglass ? 26 : this.sailing ? 50 : 48;
    this.fov = snap ? targetFov : THREE.MathUtils.lerp(this.fov, targetFov, 1 - Math.pow(0.01, dt));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const dist = this.sailing ? this.camDist + 3 : this.camDist;
    const pitch = this.camPitch;
    const t = this.eva.group.position;
    const look = new THREE.Vector3(t.x, t.y + 1.15, t.z);
    const ox = Math.sin(this.camYaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist;
    const oz = Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(look.x - ox, look.y + oy, look.z - oz);
    const follow = snap ? 1 : 1 - Math.pow(0.02, dt);
    if (snap) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, follow);
    this.camera.lookAt(look);
    this.sky.dir.target.position.copy(t);
    this.sky.dir.target.updateMatrixWorld();
    this.sky.dir.position.copy(t).add(this.sky.sunDir.clone().multiplyScalar(70));
  }

  /** Animal Crossing-style: locked 3/4 of the whole room, no orbit. */
  private applyInteriorCamera() {
    const f = this.currentInterior!.floor;
    const cx = (f.minX + f.maxX) * 0.5;
    const cz = (f.minZ + f.maxZ) * 0.5;
    const spanX = f.maxX - f.minX;
    const spanZ = f.maxZ - f.minZ;
    this.camYaw = Math.PI;
    this.camPitch = 0.72;
    const portrait = this.camera.aspect < 0.86;
    this.fov = portrait ? 58 : 44;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const look = new THREE.Vector3(cx, 0.72, cz - spanZ * 0.06);
    const vFov = THREE.MathUtils.degToRad(this.fov);
    const halfH = Math.tan(vFov / 2);
    const halfW = halfH * Math.max(this.camera.aspect, 0.42);
    const pitch = this.camPitch;
    const dist = Math.max((spanX + 2.4) / (2 * halfW * Math.max(Math.cos(pitch), 0.28)), 12.5);
    const ox = Math.sin(this.camYaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist;
    const oz = Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(look.x - ox, look.y + oy, look.z - oz);
    this.camera.position.copy(desired);
    this.camera.lookAt(look);
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

    if (!this.sailing) {
      const reef = ISLANDS.find((i) => i.id === "reef")!;
      if (Math.hypot(p.x - reef.x, p.z - reef.z) < reef.radius * 0.85) {
        consider("E — Listen to the reef", () => this.listenReef());
      }
      const yard = yardPoint();
      if (Math.hypot(p.x - yard.x, p.z - yard.z) < 2.4) {
        consider(this.save.yardItem ? "E — Take the yard hanging" : "E — Hang something on the line", () => this.openYard());
      }
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
    if (!this.sailing && boatD < 5.4) {
      consider("E — Board the red boat", () => {
        this.sailing = true;
        this.sailAmount = 0.55;
        this.boatSpeed = 0;
        this.camYaw = this.boatYaw;
        this.camPitch = 0.3;
        this.camDist = Math.max(this.camDist, 13);
        this.updateCamera(1, true);
        this.audio.foley("sail");
        this.advanceIntro(INTRO.boarded, "Meadow Isle is west of the kettle island. Mallow keeps the kettle on.");
        if (!this.sailedHint) {
          this.sailedHint = true;
          if (this.save.introBeat > INTRO.boarded) this.toast("W and S to go. Tap Compass to call the wind to your bow.");
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
    const depth = h.kind === "home" ? 3.75 : h.kind === "coral" ? 2.25 : h.kind === "mallow" ? 2.4 : h.kind === "pebble" ? 4.15 : 2.35;
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
    } else {
      const npc = h.kind as NpcId;
      fillNpcGift(room, this.save.npcGifts[npc] ?? null);
      fillFriendDecor(room, friendTier(this.save.friendship[npc] ?? 0));
      if (this.isNight()) this.toast(`${NPCS[npc].name} came in from the dark.`);
    }
    this.renderPass.scene = this.interiorScene;
    this.worldCam = { yaw: this.camYaw, pitch: this.camPitch, dist: this.camDist };
    this.camYaw = Math.PI;
    this.setState("interior");
    this.updateCamera(1, true);
    this.audio.foley("door");
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
    this.audio.foley("door");
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
    if (kind.type === "gift") this.openGift(kind.id);
  }

  private restoreShelfLabels() {
    const title = document.querySelector("#shelf-picker h2");
    const muted = document.querySelector("#shelf-picker .muted");
    if (title) title.textContent = "Place on the shelf";
    if (muted) muted.textContent = "Choose a treasure to display in this nook.";
  }

  private openShelf(index: number) {
    this.shelfIndex = index;
    this.giftTarget = null;
    this.restoreShelfLabels();
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
      el.innerHTML = `<img alt="" src="${itemIcon(def)}"/><div><div class="name">${def.name}</div><div class="qty">${def.rarity} · ×${n}</div></div>`;
      el.onclick = () => this.placeOnShelf(id);
      grid.append(el);
    }
  }

  private placeOnShelf(id: string | null) {
    const prev = this.save.displayed[this.shelfIndex];
    if (prev) this.save.items[prev] = (this.save.items[prev] ?? 0) + 1;
    if (id) {
      if ((this.save.items[id] ?? 0) <= 0) return;
      this.save.items[id]--;
    }
    this.save.displayed[this.shelfIndex] = id;
    if (this.currentInterior) fillShelf(this.currentInterior, this.save.displayed);
    this.setState("interior");
    this.audio.foley("place");
    this.persist();
    if (id) this.advanceIntro(INTRO.shelved, "When you're sleepy, the quilt will keep the morning.");
  }

  private pickupDecor(obj: THREE.Object3D) {
    const id = obj.name || (obj.children[0] as THREE.Object3D | undefined)?.parent?.userData?.id;
    const match = this.save.decorations.find((d) => Math.hypot(d.x - obj.position.x, d.z - obj.position.z) < 0.2);
    if (match) {
      this.save.items[match.id] = (this.save.items[match.id] ?? 0) + 1;
      this.save.decorations = this.save.decorations.filter((d) => d !== match);
      if (this.currentInterior) rebuildDecor(this.currentInterior, this.save.decorations);
      this.persist();
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
    this.audio.foley("place");
    this.persist();
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
    this.audio.foley("dock");
    this.persist();
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
      this.boat.group.position.x + fx * 2.35,
      this.boat.group.position.y + 0.48,
      this.boat.group.position.z + fz * 2.35,
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
    const aura = p.mesh.getObjectByName("aura");
    if (aura) p.mesh.remove(aura);
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
    this.persist();
    if (p.id === "intro-cockle" || this.save.introBeat < INTRO.picked) {
      this.advanceIntro(INTRO.picked, "The red boat is waiting on the water.");
    }
  }

  private updateLootFly(dt: number) {
    const eva = this.eva.group;
    const fwd = new THREE.Vector3(Math.sin(eva.rotation.y), 0, Math.cos(eva.rotation.y));
    for (let i = this.flyLoot.length - 1; i >= 0; i--) {
      const f = this.flyLoot[i];
      f.t += dt;
      const dur = f.rarity === "legendary" ? 1.08 : f.rarity === "rare" ? 0.86 : f.rarity === "uncommon" ? 0.6 : 0.42;
      const u = Math.min(1, f.t / dur);
      const hands = eva.position.clone().add(fwd.clone().multiplyScalar(0.55));
      hands.y += 0.12;
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
    const n = rarity === "legendary" ? 14 : rarity === "rare" ? 9 : rarity === "uncommon" ? 6 : 4;
    const size = rarity === "legendary" ? 0.42 : rarity === "rare" ? 0.32 : 0.24;
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
    const hint = $("inv-hint");
    if (hint) {
      hint.textContent =
        this.invTab === "decor"
          ? this.currentInterior?.id === "home"
            ? "Tap a piece to set it down where Eva is standing."
            : "Decor belongs in Eva's cottage."
          : "Tap a find to turn it in the light.";
    }
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
      el.innerHTML = `<img alt="" src="${itemIcon(def)}"/><div><div class="name">${def.name}</div><div class="qty">${def.rarity} · ×${n}</div></div>`;
      el.onclick = () => {
        if (id === "sea_chart") {
          this.openChart();
          return;
        }
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
    bumpTalk(this.save, id);
    if (!this.save.questsHeard.includes(id)) this.save.questsHeard.push(id);
    $("dlg-name").textContent = `${npc.name} · ${npc.species}`;
    const pips = $("dlg-pips");
    if (pips) pips.textContent = `${npc.pip} ${friendPips(this.save.friendship[id] ?? 0)}`;
    if (!this.portraits.has(id)) this.portraits.set(id, npcPortrait(id));
    $("dlg-portrait").style.backgroundImage = `url(${this.portraits.get(id)})`;
    $("dlg-portrait").style.backgroundColor = "transparent";
    $("dlg-text").textContent = greetingFor(this.save, id, this.isNight());
    const choices: { label: string; fn: () => void }[] = [
      { label: "Chat a while", fn: () => this.say(this.chatLine(id)) },
      { label: "Who are you?", fn: () => this.say(npc.personality) },
      { label: "Trade", fn: () => this.showTrades(id) },
    ];
    if (questOpen(this.save, id)) {
      choices.splice(1, 0, { label: "About that errand…", fn: () => this.say(this.isNight() ? npc.questHint : npc.questOpen) });
    }
    choices.push({ label: "See you on the tide", fn: () => this.setState(this.currentInterior ? "interior" : "world") });
    this.drawChoices(choices);
    if (id === "mallow") this.advanceIntro(INTRO.mallow);
    this.persist();
  }

  private chatLine(id: NpcId) {
    const npc = NPCS[id];
    if (questOpen(this.save, id) && Math.random() < 0.45) return npc.questHint;
    return npc.chat[Math.floor(Math.random() * npc.chat.length)];
  }

  private say(text: string) {
    $("dlg-text").textContent = text;
    if (!this.talkingTo) return;
    this.drawChoices([{ label: "Back", fn: () => this.openDialogue(this.talkingTo!) }]);
  }

  private showTrades(id: NpcId) {
    this.dialogueMode = "trade";
    const npc = NPCS[id];
    const tier = friendTier(this.save.friendship[id] ?? 0);
    $("dlg-text").textContent = "What shall we swap, then?";
    const choices = npc.trades
      .filter((t) => !(t.once && this.save.tradesDone.includes(t.id)))
      .filter((t) => tier >= (t.needFriend ?? 0))
      .map((t) => ({
        label: t.label,
        fn: () => this.tryTrade(t),
      }));
    if (!choices.length) $("dlg-text").textContent = "Nothing to swap just now — come back when the tide's been kinder.";
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
    this.persist();
    if (this.talkingTo && t.id === NPCS[this.talkingTo].questTrade) {
      this.say(NPCS[this.talkingTo].questDone + " " + t.success);
    } else {
      this.say(t.success);
    }
    if (t.id === "mallow-cushion") {
      this.advanceIntro(INTRO.traded, "Put that cushion on your shelf at home. A house should remember its guests.");
    }
    if (t.id === "brine-chart") {
      this.toast("The chart is yours. Open it from pause, or tap it in the satchel. M to unfold.");
    }
    if (this.talkingTo && this.currentInterior) {
      fillFriendDecor(this.currentInterior, friendTier(this.save.friendship[this.talkingTo] ?? 0));
    }
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
    this.restoreVisitor();
    this.save.day += 1;
    this.save.time = 0.3;
    this.save.morningFog = false;
    this.save.morningEvent = null;
    const roll = Math.random();
    let morning = "Morning pours in through the pink windows.";
    if (roll < 0.2) {
      this.save.morningEvent = "uncommon";
      morning = "The beach left an extra blush of scallop overnight.";
    } else if (roll < 0.32) {
      this.save.morningEvent = "visitor";
      const guests: NpcId[] = ["mallow", "brine", "coral", "pebble"];
      const who = guests[this.save.day % 4];
      morning = `${NPCS[who].name} left footprints on the home pier — a neighbour came by with the tide.`;
    } else if (roll < 0.44) {
      this.save.morningFog = true;
      this.save.morningEvent = "fog";
      morning = "A hush of fog sits on the kettle island.";
    } else if (roll < 0.54) {
      this.save.morningEvent = "squall";
      morning = "The wind woke in a mood. Call it to your bow if you sail.";
    }
    $("sleep-title").textContent = `Day ${this.save.day}`;
    $("sleep-line").textContent = SLEEP_LINES[(this.save.day - 1) % SLEEP_LINES.length];
    this.audio.chime("sleep");
    this.collect.spawn(this.save.collected, this.save.day);
    if (this.save.morningEvent === "uncommon") this.collect.addExtra(`dawn-${this.save.day}`, "sunset_scallop", 12, 8);
    this.parkVisitor();
    this.advanceIntro(INTRO.slept, "Captain Brine at the harbor knows a chart, if the sea starts feeling large.");
    this.persist();
    setTimeout(() => {
      this.setState("interior");
      this.toast(morning);
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
      if (this.sailing) wind.textContent = `Compass ${this.windArrow()} ${this.windLabel()} · tap`;
    }
    const help = $("hud-help");
    if (help) help.classList.toggle("hidden", this.save.introBeat >= INTRO.boarded);
    $("touch-decor").classList.toggle("hidden", this.currentInterior?.id !== "home");
    $("touch-look").classList.toggle("hidden", !!this.currentInterior);
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
    else if (/Listen/i.test(p)) label = "Hear";
    else if (/Hang|yard hanging/i.test(p)) label = "Hang";
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

  private advanceIntro(beat: number, line?: string) {
    if (this.save.introBeat >= beat) return;
    this.save.introBeat = beat;
    if (line) this.toast(line);
    this.persist();
  }

  private updatePorchLamps() {
    const night = this.isNight();
    this.world.traverse((o) => {
      if (o.name === "porch-lamp" && o instanceof THREE.PointLight) o.intensity = night ? 1.15 : 0;
    });
  }

  private maybeLookoutHint() {
    if (!this.spyglass || this.save.lookoutHint || this.currentInterior) return;
    const look = ISLANDS.find((i) => i.id === "lookout")!;
    const p = this.eva.group.position;
    if (Math.hypot(p.x - look.x, p.z - look.z) > look.radius * 0.8) return;
    if (p.y < heightAt(look.x, look.z) - 0.4) return;
    this.save.lookoutHint = true;
    this.toast("A sparkle winks far to the north-east — Whisper Reef, shy as ever.");
    this.persist();
  }

  private parkVisitor() {
    this.restoreVisitor();
    if (this.save.morningEvent !== "visitor") return;
    const guests: NpcId[] = ["mallow", "brine", "coral", "pebble"];
    const who = guests[this.save.day % 4];
    const mesh = this.npcs.get(who);
    if (!mesh) return;
    mesh.userData.homeX = mesh.position.x;
    mesh.userData.homeZ = mesh.position.z;
    mesh.userData.visiting = true;
    const home = ISLANDS[0];
    const ang = PIER_ANG.home;
    const beach = beachPoint(home, home.x + Math.cos(ang) * 40, home.z + Math.sin(ang) * 40);
    mesh.position.set(beach.x, heightAt(beach.x, beach.z), beach.z);
  }

  private restoreVisitor() {
    this.npcs.forEach((mesh) => {
      if (!mesh.userData.visiting) return;
      const x = mesh.userData.homeX as number;
      const z = mesh.userData.homeZ as number;
      mesh.position.set(x, heightAt(x, z), z);
      mesh.userData.visiting = false;
    });
  }

  private maybeVisitorGoHome() {
    if (this.save.morningEvent !== "visitor" || !this.isNight()) return;
    this.restoreVisitor();
    this.save.morningEvent = null;
    this.persist();
  }

  private listenReef() {
    this.save.reefListened = true;
    this.audio.chime("rare");
    this.toast("The water talks in a small voice. It remembers every shell you ever picked up.");
    this.persist();
  }

  private rotateNearestDecor() {
    if (!this.currentInterior) return;
    const p = this.eva.group.position;
    let best = this.save.decorations[0];
    let bd = 1.6;
    for (const d of this.save.decorations) {
      const dist = Math.hypot(p.x - d.x, p.z - d.z);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    if (!best || bd >= 1.6) return;
    best.rot += Math.PI / 4;
    rebuildDecor(this.currentInterior, this.save.decorations);
    this.audio.foley("place");
    this.persist();
  }

  private openGift(id: NpcId) {
    this.giftTarget = id;
    const title = document.querySelector("#shelf-picker h2");
    const muted = document.querySelector("#shelf-picker .muted");
    if (title) title.textContent = `A gift for ${NPCS[id].name}`;
    if (muted) muted.textContent = this.save.npcGifts[id] ? "Leave a new find, or take the old one home." : "Choose a shell or stone to leave on their table.";
    this.setState("gift");
    const grid = $("shelf-grid");
    grid.innerHTML = "";
    if (this.save.npcGifts[id]) {
      const take = document.createElement("button");
      take.className = "inv-item";
      take.innerHTML = `<div class="name">Take the gift back</div>`;
      take.onclick = () => this.leaveGift(null);
      grid.append(take);
    }
    const finds = Object.entries(this.save.items).filter(([item, n]) => n > 0 && (ITEMS[item]?.kind === "shell" || ITEMS[item]?.kind === "rock"));
    for (const [item, n] of finds) {
      const def = ITEMS[item];
      const el = document.createElement("button");
      el.className = "inv-item";
      el.innerHTML = `<img alt="" src="${itemIcon(def)}"/><div><div class="name">${def.name}</div><div class="qty">×${n}</div></div>`;
      el.onclick = () => this.leaveGift(item);
      grid.append(el);
    }
  }

  private leaveGift(id: string | null) {
    const who = this.giftTarget;
    if (!who || who === "yard") return;
    const prev = this.save.npcGifts[who];
    if (prev) this.save.items[prev] = (this.save.items[prev] ?? 0) + 1;
    if (id) {
      if ((this.save.items[id] ?? 0) <= 0) return;
      this.save.items[id]--;
      this.save.friendship[who] = (this.save.friendship[who] ?? 0) + 1;
    }
    this.save.npcGifts[who] = id;
    if (this.currentInterior) {
      fillNpcGift(this.currentInterior, id);
      fillFriendDecor(this.currentInterior, friendTier(this.save.friendship[who] ?? 0));
    }
    this.giftTarget = null;
    this.setState("interior");
    this.audio.chime("uncommon");
    this.persist();
    this.toast(id ? `${NPCS[who].name} will keep that safe.` : "You tuck it back into the satchel.");
  }

  private openYard() {
    if (this.save.yardItem) {
      this.save.items[this.save.yardItem] = (this.save.items[this.save.yardItem] ?? 0) + 1;
      this.save.yardItem = null;
      this.refreshYard();
      this.persist();
      this.audio.foley("place");
      this.toast("Down from the line and back in the bag.");
      return;
    }
    this.giftTarget = "yard";
    const title = document.querySelector("#shelf-picker h2");
    const muted = document.querySelector("#shelf-picker .muted");
    if (title) title.textContent = "Hang on the line";
    if (muted) muted.textContent = "A little outdoor souvenir.";
    this.setState("gift");
    const grid = $("shelf-grid");
    grid.innerHTML = "";
    const dec = Object.entries(this.save.items).filter(([item, n]) => n > 0 && ITEMS[item]?.kind === "decor");
    for (const [item, n] of dec) {
      const def = ITEMS[item];
      const el = document.createElement("button");
      el.className = "inv-item";
      el.innerHTML = `<img alt="" src="${itemIcon(def)}"/><div><div class="name">${def.name}</div><div class="qty">×${n}</div></div>`;
      el.onclick = () => this.hangYard(item);
      grid.append(el);
    }
  }

  private hangYard(id: string) {
    if ((this.save.items[id] ?? 0) <= 0) return;
    this.save.items[id]--;
    this.save.yardItem = id;
    this.giftTarget = null;
    this.refreshYard();
    this.setState("world");
    this.audio.foley("place");
    this.persist();
  }

  private refreshYard() {
    if (this.yardVis) {
      this.world.remove(this.yardVis);
      this.yardVis = null;
    }
    if (!this.save.yardItem) return;
    const y = yardPoint();
    const vis = createItemVisual(this.save.yardItem);
    vis.position.set(y.x, heightAt(y.x, y.z) + 1.05, y.z);
    vis.scale.setScalar(0.85);
    this.world.add(vis);
    this.yardVis = vis;
  }

  private openChart() {
    if (!hasChart(this.save)) {
      this.toast("Brine keeps the charts. A pearl mussel might loosen one.");
      return;
    }
    this.setState("chart");
  }

  private drawChart() {
    const canvas = $<HTMLCanvasElement>("chart-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#e8c99a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c48a4a";
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#7eb7d9";
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.arc(60 + (i * 97) % (w - 80), 40 + (i * 53) % (h - 80), 18 + (i % 5) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const xs = ISLANDS.map((i) => i.x);
    const zs = ISLANDS.map((i) => i.z);
    const minX = Math.min(...xs) - 40;
    const maxX = Math.max(...xs) + 40;
    const minZ = Math.min(...zs) - 40;
    const maxZ = Math.max(...zs) + 40;
    const sx = (x: number) => 50 + ((x - minX) / (maxX - minX)) * (w - 100);
    const sy = (z: number) => 40 + ((z - minZ) / (maxZ - minZ)) * (h - 90);
    for (const isl of ISLANDS) {
      const known = this.save.discovered.includes(isl.id);
      const rumor = !known && (isl.id === "reef" || isl.id === "lookout");
      ctx.beginPath();
      ctx.arc(sx(isl.x), sy(isl.z), known ? 16 : 10, 0, Math.PI * 2);
      ctx.fillStyle = known ? "#6fbf8a" : rumor ? "#c45a6a" : "#bba48a";
      ctx.fill();
      ctx.fillStyle = "#3a2412";
      ctx.font = "16px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(known ? isl.name : rumor ? "X" : "?", sx(isl.x), sy(isl.z) - 20);
    }
    const bx = this.sailing ? this.boat.group.position.x : this.eva.group.position.x;
    const bz = this.sailing ? this.boat.group.position.z : this.eva.group.position.z;
    ctx.fillStyle = "#e23a3a";
    ctx.beginPath();
    ctx.moveTo(sx(bx), sy(bz) - 10);
    ctx.lineTo(sx(bx) + 7, sy(bz) + 8);
    ctx.lineTo(sx(bx) - 7, sy(bz) + 8);
    ctx.closePath();
    ctx.fill();
    const rumor = $("chart-rumor");
    if (rumor) {
      const bits: string[] = [];
      bits.push(
        this.save.discovered.includes("reef")
          ? "The reef has a name now. Whisper. You were there."
          : "X marks a whisper due north. Sail till the water turns shy.",
      );
      if (!this.save.discovered.includes("lookout")) bits.push("A steep hat of stone sits west of home. Climb. Look.");
      rumor.textContent = bits.join(" ");
    }
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
    }
    this.camera.position.set(this.eva.group.position.x + 8, 8, this.eva.group.position.z + 8);
    this.updateCamera(1, true);
  }
}

