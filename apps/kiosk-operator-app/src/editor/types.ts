export interface StickerDef {
  id: string;
  emoji: string;
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
}

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

export const FONTS: FontOption[] = [
  { id: "sans", label: "Arial", family: "Arial, sans-serif" },
  { id: "impact", label: "Impact", family: "Impact, sans-serif" },
  { id: "serif", label: "Georgia", family: "Georgia, serif" },
  { id: "mono", label: "Courier", family: "'Courier New', monospace" },
  { id: "comic", label: "Comic Sans", family: "'Comic Sans MS', cursive" },
];

export const TEXT_COLORS: string[] = [
  "#111111",
  "#ffffff",
  "#dc2626",
  "#1e3a8a",
  "#16a34a",
  "#eab308",
];
