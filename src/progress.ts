import { ITEMS, NPCS } from "./catalog";
import type { NpcId, SaveData } from "./types";

export const INTRO = {
  wake: 0,
  picked: 1,
  boarded: 2,
  mallow: 3,
  traded: 4,
  shelved: 5,
  slept: 6,
} as const;

export function friendTier(n: number): 0 | 1 | 2 | 3 {
  if (n >= 7) return 3;
  if (n >= 4) return 2;
  if (n >= 2) return 1;
  return 0;
}

export function friendPips(n: number): string {
  const t = friendTier(n);
  return "♥".repeat(t) + "♡".repeat(3 - t);
}

export function hasChart(save: SaveData): boolean {
  return (save.items.sea_chart ?? 0) > 0 || save.tradesDone.includes("brine-chart");
}

export function questOpen(save: SaveData, id: NpcId): boolean {
  return save.questsHeard.includes(id) && !save.tradesDone.includes(NPCS[id].questTrade);
}

export function greetingFor(save: SaveData, id: NpcId, night: boolean): string {
  const npc = NPCS[id];
  if (night) return npc.nightLine;
  const t = friendTier(save.friendship[id] ?? 0);
  const gift = save.npcGifts[id];
  if (gift && ITEMS[gift] && t >= 1) {
    return `You still smell a little like ${ITEMS[gift].name}. I kept a place for it.`;
  }
  if (t >= 3 && npc.close.length) return npc.close[Math.floor(Math.random() * npc.close.length)];
  if (t >= 2 && npc.warm.length) return npc.warm[Math.floor(Math.random() * npc.warm.length)];
  return npc.greeting[Math.floor(Math.random() * npc.greeting.length)];
}

export function bumpTalk(save: SaveData, id: NpcId): boolean {
  if (save.talkedDay[id] === save.day) return false;
  save.talkedDay[id] = save.day;
  save.friendship[id] = (save.friendship[id] ?? 0) + 1;
  return true;
}
