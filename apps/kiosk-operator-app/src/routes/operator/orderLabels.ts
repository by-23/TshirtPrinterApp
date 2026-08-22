import { GARMENT_COLORS, type GarmentSide, type GarmentType, type OrderStatus } from "@tshirt/shared-types";

/**
 * The operator screen is Russian-only (matches `docs/ui-mockups/operator.png`,
 * which has no language switcher) — plain strings here rather than routing
 * through `react-i18next` like the customer-facing kiosk screens.
 */
export const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};

export const GARMENT_SIDE_LABELS: Record<GarmentSide, string> = {
  front: "Перед",
  back: "Спина",
};

export function formatOrderSides(sides: GarmentSide[]): string {
  return sides.map((side) => GARMENT_SIDE_LABELS[side]).join(" + ");
}

export function formatDesignCount(count: number): string {
  if (count === 1) return "1 дизайн";
  if (count >= 2 && count <= 4) return `${count} дизайна`;
  return `${count} дизайнов`;
}

export const FABRIC_LABELS: Record<string, string> = {
  cotton: "100% хлопок",
  premium: "Премиум ткань",
};

export const PRINT_SIZE_LABELS: Record<string, string> = {
  small: "Маленький",
  medium: "Средний",
  large: "Большой",
};

const COLOR_NAME_BY_ID: Record<string, string> = {
  white: "Белый",
  black: "Чёрный",
  gray: "Серый",
  cream: "Бежевый",
  pink: "Розовый",
  lightBlue: "Голубой",
  green: "Зелёный",
  yellow: "Жёлтый",
  red: "Красный",
  darkGreen: "Тёмно-зелёный",
  purple: "Фиолетовый",
  navy: "Тёмно-синий",
};

export function garmentColorLabel(hex: string): string {
  const match = GARMENT_COLORS.find((option) => option.hex.toLowerCase() === hex.toLowerCase());
  return match ? (COLOR_NAME_BY_ID[match.id] ?? hex) : hex;
}

export interface StatusPresentation {
  label: string;
  bg: string;
  fg: string;
}

/**
 * Stage 5 folds `accepted`/`printing` into one "В работе" bucket for the
 * operator UI — see the Stage 5 plan's decision to skip a dedicated
 * `printing` click and treat acceptance as "now being printed manually".
 */
export const STATUS_PRESENTATION: Record<OrderStatus, StatusPresentation> = {
  new: { label: "НОВЫЙ", bg: "rgba(255, 45, 120, 0.18)", fg: "#ff5f9e" },
  accepted: { label: "В РАБОТЕ", bg: "rgba(245, 166, 35, 0.18)", fg: "#f5a623" },
  printing: { label: "В РАБОТЕ", bg: "rgba(245, 166, 35, 0.18)", fg: "#f5a623" },
  done: { label: "ГОТОВ", bg: "rgba(46, 204, 113, 0.18)", fg: "#2ecc71" },
  cancelled: { label: "ОТМЕНЁН", bg: "rgba(139, 143, 163, 0.18)", fg: "#8b8fa3" },
};

export function formatOrderTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatOrderDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatPrice(tenge: number): string {
  return `${Math.round(tenge).toLocaleString("ru-RU")} ₸`;
}
