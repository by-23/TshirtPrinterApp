export interface StickerDef {
  id: string;
  emoji: string;
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
}

export { EDITOR_FONTS as FONTS } from "../lib/fonts.js";

export const STICKERS: StickerDef[] = [
  { id: "fire", emoji: "🔥" },
  { id: "heart", emoji: "❤️" },
  { id: "star", emoji: "⭐" },
  { id: "smile", emoji: "😂" },
  { id: "skull", emoji: "💀" },
  { id: "crown", emoji: "👑" },
  { id: "thumbsUp", emoji: "👍" },
  { id: "rocket", emoji: "🚀" },
];

export const TEXT_COLORS: string[] = [
  "#111111",
  "#ffffff",
  "#dc2626",
  "#1e3a8a",
  "#16a34a",
  "#eab308",
];
