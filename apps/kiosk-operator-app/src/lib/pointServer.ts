import { io, type Socket } from "socket.io-client";
import {
  ORDER_EVENT_CHANNEL,
  orderEventSchema,
  type CreateOrderInput,
  type Design,
  type DesignCategory,
  type Order,
  type OrderEvent,
  type OrderStatus,
} from "@tshirt/shared-types";

export const POINT_SERVER_URL = "http://localhost:4000";

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${POINT_SERVER_URL}/health`);
  if (!res.ok) {
    throw new Error(`point-server health check failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchDesigns(category?: DesignCategory): Promise<Design[]> {
  const url = new URL(`${POINT_SERVER_URL}/catalog/designs`);
  if (category) {
    url.searchParams.set("category", category);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch designs: ${res.status}`);
  }
  return res.json();
}

export async function fetchDesign(id: string): Promise<Design> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/designs/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch design ${id}: ${res.status}`);
  }
  return res.json();
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const res = await fetch(`${POINT_SERVER_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to create order: ${res.status}`);
  }
  return res.json();
}

export async function fetchOrder(id: string): Promise<Order> {
  const res = await fetch(`${POINT_SERVER_URL}/orders/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch order ${id}: ${res.status}`);
  }
  return res.json();
}

/** Used by the operator feed for its initial load (realtime updates arrive via `subscribeOrderEvents`). */
export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${POINT_SERVER_URL}/orders`);
  if (!res.ok) {
    throw new Error(`Failed to fetch orders: ${res.status}`);
  }
  return res.json();
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const res = await fetch(`${POINT_SERVER_URL}/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update order ${id}: ${res.status}`);
  }
  return res.json();
}

let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  sharedSocket ??= io(POINT_SERVER_URL, { autoConnect: true, reconnection: true });
  return sharedSocket;
}

/**
 * Subscribes to order create/update events (operator feed + kiosk checkout
 * both use this). Returns an unsubscribe function. Purely additive to the
 * existing REST polling/fetches — if the socket connection drops, callers
 * keep working off their last known state (fail-open).
 */
export function subscribeOrderEvents(callback: (event: OrderEvent) => void): () => void {
  const socket = getSocket();
  const handler = (payload: unknown) => {
    const parsed = orderEventSchema.safeParse(payload);
    if (parsed.success) callback(parsed.data);
  };
  socket.on(ORDER_EVENT_CHANNEL, handler);
  return () => {
    socket.off(ORDER_EVENT_CHANNEL, handler);
  };
}
