/**
 * Added to the stored order id so the ticket looks like a 4-digit number
 * (order 7 → 1007), matching checkout.png ("№ 1247").
 */
export const DISPLAY_ORDER_NUMBER_OFFSET = 1000;

/** Public ticket number shown on the kiosk and the operator screen. */
export function displayOrderNumber(orderId: string | number): string {
  const n = typeof orderId === "number" ? orderId : Number(orderId);
  if (!Number.isFinite(n)) return String(orderId);
  return String(n + DISPLAY_ORDER_NUMBER_OFFSET);
}

/** True if the search box matches the stored id or the public ticket. */
export function orderNumberMatchesQuery(orderId: string, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const ticket = displayOrderNumber(orderId);
  const normalized = raw.replace(/^[№nN#]\s*/, "").trim();
  return orderId.includes(normalized) || ticket.includes(normalized);
}
