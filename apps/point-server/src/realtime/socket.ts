import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import {
  ORDER_EVENT_CHANNEL,
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
