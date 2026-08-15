import type { NpcId, SaveData } from "./types";
import { SHELF_SLOTS } from "./catalog";

const KEY = "tibu-eva-save-v1";

function emptyGifts(): Record<NpcId, string | null> {
  return { mallow: null, pebble: null, coral: null, brine: null };
}

export function migrateSave(data: SaveData): SaveData {
  return {
    ...freshSave(),
    ...data,
    items: data.items ?? {},
    displayed: data.displayed?.length ? data.displayed : Array.from({ length: SHELF_SLOTS }, () => null),
    decorations: data.decorations ?? [],
    discovered: data.discovered ?? ["home"],
    collected: data.collected ?? [],
    tradesDone: data.tradesDone ?? [],
    friendship: { mallow: 0, pebble: 0, coral: 0, brine: 0, ...data.friendship },
    introBeat: data.introBeat ?? 6,
    npcGifts: { ...emptyGifts(), ...data.npcGifts },
    questsHeard: data.questsHeard ?? [],
    talkedDay: data.talkedDay ?? {},
    volume: data.volume ?? 0.7,
    morningFog: data.morningFog ?? false,
    morningEvent: data.morningEvent ?? null,
    lookoutHint: data.lookoutHint ?? false,
    yardItem: data.yardItem ?? null,
    reefListened: data.reefListened ?? false,
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw) as SaveData);
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
    eva: { x: 8, z: 12, sailing: false },
    boat: { x: 72, z: 26, yaw: -0.6 },
    introBeat: 0,
    npcGifts: emptyGifts(),
    questsHeard: [],
    talkedDay: {},
    volume: 0.7,
    morningFog: false,
    morningEvent: null,
    lookoutHint: false,
    yardItem: null,
    reefListened: false,
  };
}
