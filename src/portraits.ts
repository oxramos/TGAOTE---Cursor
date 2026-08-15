import type { ItemDef, NpcId } from "./types";
import { NPCS } from "./catalog";

function canvas(size = 96): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function npcPortrait(id: NpcId): string {
  const [c, ctx] = canvas(128);
  const npc = NPCS[id];
  const bg = hex(npc.accent);
  const fg = hex(npc.color);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = fg;
  if (id === "mallow") {
    ctx.beginPath();
    ctx.ellipse(64, 78, 42, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6ea";
    for (const [x, y] of [
      [32, 48],
      [64, 38],
      [96, 48],
      [40, 70],
      [88, 70],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2a1a12";
    ctx.beginPath();
    ctx.arc(50, 80, 5, 0, Math.PI * 2);
    ctx.arc(78, 80, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e56b9e";
    ctx.beginPath();
    ctx.ellipse(64, 94, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "pebble") {
    ctx.beginPath();
    ctx.ellipse(64, 72, 38, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a1a12";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(50, 70, 10, 0, Math.PI * 2);
    ctx.arc(78, 70, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(60, 70);
    ctx.lineTo(68, 70);
    ctx.stroke();
    ctx.fillStyle = "#2a1a12";
    ctx.beginPath();
    ctx.arc(50, 70, 4, 0, Math.PI * 2);
    ctx.arc(78, 70, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "coral") {
    ctx.fillStyle = "#e23a3a";
    ctx.beginPath();
    ctx.ellipse(64, 76, 32, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c14e";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(40 + i * 12, 42, 7, 16, (i - 2) * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2a1a12";
    ctx.beginPath();
    ctx.arc(52, 78, 5, 0, Math.PI * 2);
    ctx.arc(76, 78, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a3d";
    ctx.beginPath();
    ctx.moveTo(64, 86);
    ctx.lineTo(88, 92);
    ctx.lineTo(64, 96);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(64, 80, 36, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(40, 38, 48, 14);
    ctx.beginPath();
    ctx.arc(64, 38, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#2a1a12";
    ctx.beginPath();
    ctx.arc(50, 80, 5, 0, Math.PI * 2);
    ctx.arc(76, 80, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c48a4a";
    ctx.beginPath();
    ctx.ellipse(92, 86, 10, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toDataURL("image/png");
}

export function itemIcon(def: ItemDef): string {
  const [c, ctx] = canvas(72);
  ctx.fillStyle = "#fffaf3";
  ctx.fillRect(0, 0, 72, 72);
  ctx.fillStyle = hex(def.color);
  ctx.beginPath();
  if (def.kind === "shell") {
    ctx.ellipse(36, 40, 22, 16, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hex(def.accent ?? 0xffffff);
    ctx.beginPath();
    ctx.ellipse(36, 38, 10, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.kind === "rock") {
    ctx.moveTo(18, 44);
    ctx.lineTo(28, 18);
    ctx.lineTo(50, 16);
    ctx.lineTo(58, 46);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(26, 16);
    ctx.lineTo(46, 16);
    ctx.quadraticCurveTo(56, 16, 56, 26);
    ctx.lineTo(56, 46);
    ctx.quadraticCurveTo(56, 56, 46, 56);
    ctx.lineTo(26, 56);
    ctx.quadraticCurveTo(16, 56, 16, 46);
    ctx.lineTo(16, 26);
    ctx.quadraticCurveTo(16, 16, 26, 16);
    ctx.closePath();
    ctx.fill();
  }
  const gem = def.rarity === "legendary" ? "#ff5d7a" : def.rarity === "rare" ? "#7b6cff" : def.rarity === "uncommon" ? "#3ecfcf" : "#c8d0d8";
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.arc(58, 14, 6, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL("image/png");
}
