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
import { buildArchipelago, heightAt, nearestIsland, beachPoint } from "./world/islands";
import { CollectibleWorld } from "./world/collectibles";
import { buildInterior, fillShelf, rebuildDecor, type InteriorRoom } from "./world/interior";
import { createNpc } from "./models/animals";
import { InspectView } from "./inspect";
import { AudioBed } from "./audio";
import { freshSave, loadSave, writeSave } from "./save";
import { glowSprite } from "./materials";
import { ITEMS, ISLANDS, NPCS, SLEEP_LINES } from "./catalog";
import type { GameState, NpcId, SaveData, TradeRecipe } from "./types";
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
  fov = 48;
  sailing = false;
  boatSpeed = 0;
  boatYaw = -0.6;
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
  private flyLoot: { mesh: THREE.Group; origin: THREE.Vector3; t: number }[] = [];
  private sparkles: { sprite: THREE.Sprite; life: number }[] = [];

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
    this.world.fog = new THREE.FogExp2(0x8ec8e8, 0.0075);
    this.world.add(this.sky.group);
    this.world.add(this.ocean.mesh);
    this.world.add(this.eva.group);
    this.world.add(this.boat.group);
    this.world.add(this.collect.group);

    const built = buildArchipelago(this.world);
    this.houses = built.houses;
    this.colliders = built.colliders;
    this.placeNpcs();

    this.interiors.set("home", buildInterior("home"));
    this.interiors.set("mallow", buildInterior("mallow"));
    this.interiors.set("pebble", buildInterior("pebble"));
    this.interiors.set("coral", buildInterior("coral"));
    this.interiors.set("brine", buildInterior("brine"));
    this.interiorScene.background = new THREE.Color("#f3d7b0");

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
    if (this.state === "title") {
      this.sky.update(0.32, dt);
      this.ocean.update(this.elapsed, this.sky.sunDir);
      this.camera.position.set(38, 14, 46);
      this.camera.lookAt(-5, 2.2, -3);
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
    this.camYaw -= mouse.x * 0.005;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch - mouse.y * 0.004, 0.12, 1.1);
    this.camDist = THREE.MathUtils.clamp(this.camDist + this.input.consumeWheel() * 0.01, 5, 22);

    this.spyglass = this.input.pressed("KeyF") && !this.currentInterior;
    $("spyglass-rim").classList.toggle("hidden", !this.spyglass);

    if (this.currentInterior) this.updateInterior(dt);
    else this.updateWorld(dt);

    this.eva.update(dt, this.isMoving(), this.sailing, this.spyglass);
    this.updateCamera(dt);
    this.updateHud();
    this.gatherPrompt();
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

    if (this.sailing) {
      const axis = this.input.moveAxis();
      this.boatYaw += axis.x * dt * 1.7;
      const accel = axis.z < 0 ? 7.5 : axis.z > 0 ? -4 : -1.8;
      this.boatSpeed = THREE.MathUtils.clamp(this.boatSpeed + accel * dt, -2, 11);
      const fx = Math.sin(this.boatYaw);
      const fz = Math.cos(this.boatYaw);
      this.boat.group.position.x += fx * this.boatSpeed * dt;
      this.boat.group.position.z += fz * this.boatSpeed * dt;
      const y = this.ocean.height(this.boat.group.position.x, this.boat.group.position.z, this.elapsed);
      this.boat.group.position.y = y + 0.12;
      this.boat.group.rotation.y = this.boatYaw;
      this.boat.group.rotation.z = Math.sin(this.elapsed * 1.4) * 0.05;
      this.boat.group.rotation.x = Math.cos(this.elapsed * 1.1) * 0.04;
      this.boat.update(this.elapsed, this.boatSpeed);
      this.eva.group.position.set(this.boat.group.position.x, this.boat.group.position.y + 0.62, this.boat.group.position.z);
      this.eva.group.rotation.y = this.boatYaw;
    } else {
      this.walk(dt, true);
      const y = this.ocean.height(this.boat.group.position.x, this.boat.group.position.z, this.elapsed);
      this.boat.group.position.y = y + 0.1;
      this.boat.update(this.elapsed, 0.2);
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
    if (!axis.x && !axis.z) return;
    const speed = 4.6;
    // Must match updateCamera: camera sits at look - (sin yaw, cos yaw), so
    // world-forward (into the view) is (sin, cos) and screen-right is forward × up.
    this.moveFwd.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    this.moveRight.crossVectors(this.moveFwd, this.moveUp).normalize();
    const mx = (this.moveRight.x * axis.x + this.moveFwd.x * -axis.z) * speed * dt;
    const mz = (this.moveRight.z * axis.x + this.moveFwd.z * -axis.z) * speed * dt;
    const nx = this.eva.group.position.x + mx;
    const nz = this.eva.group.position.z + mz;
    if (onWorld) {
      if (this.blocked(nx, nz)) return;
      const h = heightAt(nx, nz);
      if (h < 0.07) return;
      this.eva.group.position.set(nx, h, nz);
    } else if (this.currentInterior) {
      const f = this.currentInterior.floor;
      this.eva.group.position.x = THREE.MathUtils.clamp(nx, f.minX, f.maxX);
      this.eva.group.position.z = THREE.MathUtils.clamp(nz, f.minZ, f.maxZ);
      this.eva.group.position.y = 0;
    }
    this.eva.group.rotation.y = Math.atan2(mx, mz);
  }

  private blocked(x: number, z: number) {
    return this.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);
  }

  private updateInterior(dt: number) {
    this.sailing = false;
    this.walk(dt, false);
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

  private updateCamera(dt: number) {
    const targetFov = this.spyglass ? 26 : this.currentInterior ? 55 : this.sailing ? 50 : 48;
    this.fov = THREE.MathUtils.lerp(this.fov, targetFov, 1 - Math.pow(0.01, dt));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const dist = this.currentInterior ? THREE.MathUtils.clamp(this.camDist, 2.4, 4.4) : this.sailing ? this.camDist + 3 : this.camDist;
    const pitch = this.currentInterior ? THREE.MathUtils.clamp(this.camPitch, 0.22, 0.55) : this.camPitch;
    const t = this.eva.group.position;
    const lookY = this.currentInterior ? 1.05 : 1.15;
    const look = new THREE.Vector3(t.x, t.y + lookY, t.z);
    const ox = Math.sin(this.camYaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist;
    const oz = Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(look.x - ox, look.y + oy, look.z - oz);
    this.camera.position.lerp(desired, 1 - Math.pow(0.02, dt));
    this.camera.lookAt(look);
    this.sky.dir.target.position.copy(t);
    this.sky.dir.target.updateMatrixWorld();
    this.sky.dir.position.copy(t).add(this.sky.sunDir.clone().multiplyScalar(70));
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
    if (!this.sailing && boatD < 3.2) {
      consider("E — Board the red boat", () => {
        this.sailing = true;
        this.boatSpeed = 0;
        this.audio.chime("ui");
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
    const depth = h.kind === "home" ? 2.9 : h.kind === "coral" ? 1.7 : h.kind === "mallow" ? 2.2 : 2.0;
    return new THREE.Vector3(Math.sin(h.yaw) * depth, 0, Math.cos(h.yaw) * depth).add(h.position);
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
    this.exitPos.copy(this.doorWorld(h));
    this.exitPos.y = heightAt(this.exitPos.x, this.exitPos.z);
    this.currentInterior = room;
    this.interiorScene.clear();
    this.interiorScene.add(room.group);
    this.interiorScene.add(this.eva.group);
    this.eva.group.position.copy(room.spawn);
    this.eva.group.rotation.y = Math.PI;
    this.sailing = false;
    if (h.kind === "home") {
      fillShelf(room, this.save.displayed);
      rebuildDecor(room, this.save.decorations);
    }
    this.renderPass.scene = this.interiorScene;
    this.camDist = 2.7;
    this.camPitch = 0.26;
    this.camYaw = Math.PI;
    this.setState("interior");
    this.audio.chime("ui");
  }

  private leaveHouse() {
    if (!this.currentInterior) return;
    this.world.add(this.eva.group);
    this.eva.group.position.copy(this.exitPos);
    this.eva.group.position.y = heightAt(this.exitPos.x, this.exitPos.z);
    this.currentInterior = null;
    this.renderPass.scene = this.world;
    this.decorate = false;
    this.setState("world");
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
    const p = beachPoint(isl, this.boat.group.position.x, this.boat.group.position.z);
    this.boat.group.position.set(p.x + (p.x - isl.x) * 0.04, 0.15, p.z + (p.z - isl.z) * 0.04);
    this.sailing = false;
    this.boatSpeed = 0;
    this.eva.group.position.set(p.x, p.y, p.z);
    this.audio.chime("ui");
  }

  private takePickup(id: string) {
    const p = this.collect.pickups.find((x) => x.id === id);
    if (!p || p.taken) return;
    this.collect.take(p);
    this.save.collected.push(p.id);
    this.save.items[p.item] = (this.save.items[p.item] ?? 0) + 1;
    const def = ITEMS[p.item];
    this.audio.chime(def.rarity);
    this.eva.playPickup();
    this.flyLoot.push({ mesh: p.mesh, origin: p.mesh.position.clone(), t: 0 });
    this.burstSparkles(p.mesh.position);
    this.toast(`Found ${def.name}!`, "found");
  }

  private updateLootFly(dt: number) {
    const hands = this.eva.group.position;
    for (let i = this.flyLoot.length - 1; i >= 0; i--) {
      const f = this.flyLoot[i];
      f.t += dt;
      const u = Math.min(1, f.t / 0.5);
      const e = 1 - (1 - u) * (1 - u) * (1 - u);
      f.mesh.position.lerpVectors(f.origin, hands, e);
      f.mesh.position.y += 0.7 * e + Math.sin(u * Math.PI) * 0.85;
      f.mesh.scale.setScalar(1 - e * 0.88);
      f.mesh.rotation.y += dt * 10;
      if (u >= 1) {
        f.mesh.visible = false;
        f.mesh.scale.setScalar(1);
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

  private burstSparkles(at: THREE.Vector3) {
    for (let i = 0; i < 8; i++) {
      const sprite = glowSprite(0xfff1a8, 0.45);
      sprite.position.set(at.x + (Math.random() - 0.5) * 0.4, at.y + 0.2, at.z + (Math.random() - 0.5) * 0.4);
      this.world.add(sprite);
      this.sparkles.push({ sprite, life: 0.45 + Math.random() * 0.2 });
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
      this.boat.group.position.set(24, 0.2, 18);
      this.boatYaw = 0.8;
      this.camYaw = 0.8;
      this.camDist = 14;
      this.camPitch = 0.3;
    }
    if (name === "collect") put(8, 124, 0.2, 8, 0.4);
    if (name === "stone") put(94, 46, -0.4, 16, 0.28);
    if (name === "palm") put(82, -74, 0.7, 13, 0.3);
    if (name === "harbor") put(-46, -90, 3.0, 12, 0.32);
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
      this.camYaw = Math.PI;
      this.camPitch = 0.22;
      this.camDist = 2.5;
    }
    this.camera.position.set(this.eva.group.position.x + 8, 8, this.eva.group.position.z + 8);
    this.updateCamera(1);
  }
}

