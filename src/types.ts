export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type ItemKind = "shell" | "rock" | "decor" | "treat";

export type ItemDef = {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  description: string;
  color: number;
  accent?: number;
  glow?: number;
};

export type NpcId = "mallow" | "pebble" | "coral" | "brine";

export type TradeRecipe = {
  id: string;
  want: { item: string; count: number }[];
  give: { item?: string; count?: number; treats?: number };
  once?: boolean;
  needFriend?: number;
  label: string;
  success: string;
};

export type GameState =
  | "title"
  | "world"
  | "interior"
  | "dialogue"
  | "inspect"
  | "inventory"
  | "shelf"
  | "paused"
  | "sleeping"
  | "chart"
  | "gift";

export type SaveData = {
  day: number;
  time: number;
  treats: number;
  items: Record<string, number>;
  displayed: (string | null)[];
  decorations: { id: string; x: number; z: number; rot: number }[];
  discovered: string[];
  collected: string[];
  tradesDone: string[];
  friendship: Record<string, number>;
  eva: { x: number; z: number; sailing: boolean };
  boat: { x: number; z: number; yaw: number };
  introBeat: number;
  npcGifts: Record<NpcId, string | null>;
  questsHeard: NpcId[];
  talkedDay: Record<string, number>;
  volume: number;
  morningFog: boolean;
  morningEvent: string | null;
  lookoutHint: boolean;
  yardItem: string | null;
  reefListened: boolean;
};
