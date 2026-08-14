import type { SaveData } from "./types";
import { SHELF_SLOTS } from "./catalog";

const KEY = "tibu-eva-save-v1";

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function freshSave(): SaveData {
  return {
    day: 1,
    time: 0.3,
    treats: 2,
    items: { potted_clover: 1 },
    displayed: Array.from({ length: SHELF_SLOTS }, () => null),
    decorations: [],
    discovered: ["home"],
    collected: [],
    tradesDone: [],
    friendship: { mallow: 0, pebble: 0, coral: 0, brine: 0 },
    eva: { x: 6, z: 8, sailing: false },
    boat: { x: 12, z: 8, yaw: -0.6 },
  };
}
