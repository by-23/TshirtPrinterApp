import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import {
  AI_PHOTO_RECEIVED_EVENT,
  ORDER_EVENT_CHANNEL,
  type AiPhotoReceivedPayload,
  type GarmentAvailabilityEvent,
  type GarmentCatalogConfig,
  type ManagedFont,
  type Order,
  type OrderEvent,
  type PointConfigSnapshot,
  type PriceConfig,
} from "@tshirt/shared-types";

let io: Server | null = null;

/** Local (kiosk/operator-facing) event carrying the latest cached `point_config` — see `modules/sync/handlers.ts`. */
export const POINT_CONFIG_EVENT_CHANNEL = "point-config:event";
/** Local event carrying the latest cached (effective) price config — see `modules/sync/handlers.ts`. */
export const PRICING_EVENT_CHANNEL = "pricing:event";
/** Local event when garment availability changes (operator save or central admin override). */
export const GARMENT_AVAILABILITY_EVENT_CHANNEL = "garment-availability:event";
/** Local event when the enabled editor font catalog changes after a central sync. */
export const FONTS_EVENT_CHANNEL = "fonts:event";
/** Local event when admin-edited garment names/colors arrive from central-relay. */
export const GARMENT_CATALOG_EVENT_CHANNEL = "garment-catalog:event";

/**
 * Attaches Socket.IO to the same underlying HTTP server Fastify listens on
 * (works for both the operator feed and the kiosk checkout screen, which
 * connect from the same origin/port). Call once, before the server starts
 * accepting requests.
 */
export function initRealtime(app: FastifyInstance): Server {
  io = new Server(app.server, { cors: { origin: true } });
  return io;
}

/** Broadcasts an order create/update to every connected client (operator feed + kiosk checkout). */
export function emitOrderEvent(type: OrderEvent["type"], order: Order): void {
  if (!io) return;
  const event: OrderEvent = { type, order };
  io.emit(ORDER_EVENT_CHANNEL, event);
}

/**
 * Broadcasts the freshly-synced point config (name/status/uploadMode) to the
 * kiosk in real time — so an admin flipping a point to "closed" blocks
 * checkout immediately, without the kiosk having to poll (Stage 7).
 */
export function emitPointConfigEvent(config: PointConfigSnapshot): void {
  if (!io) return;
  io.emit(POINT_CONFIG_EVENT_CHANNEL, config);
}

/** Broadcasts a freshly-synced effective price config so the editor's live price updates without a reload (Stage 7). */
export function emitPricingEvent(config: PriceConfig): void {
  if (!io) return;
  io.emit(PRICING_EVENT_CHANNEL, config);
}

/** Broadcasts garment availability + admin-lock flag to operator Materials panel and kiosk editor. */
export function emitGarmentAvailabilityEvent(payload: GarmentAvailabilityEvent): void {
  if (!io) return;
  io.emit(GARMENT_AVAILABILITY_EVENT_CHANNEL, payload);
}

/** Broadcasts the enabled editor font list so TextTool refreshes without a reload. */
export function emitFontsEvent(fonts: ManagedFont[]): void {
  if (!io) return;
  io.emit(FONTS_EVENT_CHANNEL, fonts);
}

/** Broadcasts admin-edited type/color/size/fabric names and color hex values. */
export function emitGarmentCatalogEvent(catalog: GarmentCatalogConfig): void {
  if (!io) return;
  io.emit(GARMENT_CATALOG_EVENT_CHANNEL, catalog);
}

/**
 * ИИ-раздел (Этап 9) — tells the kiosk's "Загрузка фото" screen a phone
 * photo has arrived, regardless of `uploadMode`: fired directly from
 * `modules/ai/routes.ts` (wifi, phone posted straight to this server) or
 * relayed from `modules/sync/client.ts` (relay, central-relay pushed it
 * down over `/relay-socket`). The kiosk matches on `sessionId` against the
 * session it's currently waiting on.
 */
export function emitAiPhotoReceivedEvent(payload: AiPhotoReceivedPayload): void {
  if (!io) return;
  io.emit(AI_PHOTO_RECEIVED_EVENT, payload);
}

/** Tell every connected kiosk/operator SPA to reload after a UI module update. */
export const UI_RELOAD_EVENT = "ui:reload";

export function emitUiReloadEvent(payload: { version?: string } = {}): void {
  if (!io) return;
  io.emit(UI_RELOAD_EVENT, payload);
}
