import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { ORDER_EVENT_CHANNEL, type Order, type OrderEvent } from "@tshirt/shared-types";

let io: Server | null = null;

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
