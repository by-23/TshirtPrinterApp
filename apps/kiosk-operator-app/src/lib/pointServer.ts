import { io, type Socket } from "socket.io-client";
import {
  AI_PHOTO_RECEIVED_EVENT,
  ORDER_EVENT_CHANNEL,
  type AiPhotoReceivedPayload,
  type AiStyle,
  type AiStyleAdmin,
  type CreateAiStyleInput,
  type UpdateAiStyleInput,
  type CatalogCacheUsage,
  type CatalogScrapeConfig,
  type CatalogScrapeStatus,
  type CategoryQueryTags,
  type CreateAiUploadSessionResponse,
  type CreateOrderInput,
  type Design,
  type DesignCategory,
  type DesignsPage,
  type GalleryCategory,
  type GiphyApiKeyTestResult,
  type Order,
  type OrderEvent,
  type OrderStatus,
  type PointConfigSnapshot,
  type PriceConfig,
  type PrintAreaConfig,
  type SetDesignIsolatedInput,
  type StylizeResponse,
  type UpdateCatalogScrapeConfigInput,
  type UpdatePrintAreaConfigInput,
  orderEventSchema,
} from "@tshirt/shared-types";

// Mirrors `POINT_CONFIG_EVENT_CHANNEL`/`PRICING_EVENT_CHANNEL` in
// `apps/point-server/src/realtime/socket.ts` — point-server is a separate
// app (not a shared package), so the literals are duplicated here rather
// than imported.
const POINT_CONFIG_EVENT_CHANNEL = "point-config:event";
const PRICING_EVENT_CHANNEL = "pricing:event";

export const POINT_SERVER_URL = "http://localhost:4000";

/** Append a fetched designs page without duplicate cards — offset pagination can overlap when the catalog grows mid-scroll. */
export function appendDesignPage(existing: Design[], incoming: Design[]): Design[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((design) => design.id));
  const fresh = incoming.filter((design) => !seen.has(design.id));
  return fresh.length > 0 ? [...existing, ...fresh] : existing;
}

/** Turns `/files/...` paths from point-server into absolute URLs for the kiosk UI. */
export function resolveDesignImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${POINT_SERVER_URL}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

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

export interface FetchDesignsPageOptions {
  search?: string;
  offset: number;
  limit: number;
  /**
   * `false` (default, matches point-server) excludes designs an operator has
   * isolated; `true` fetches *only* isolated ones — used by the operator
   * panel's "Изолированные" filter (see `DesignsPanel.tsx`). The kiosk
   * gallery never sets this, so isolated designs simply never appear there.
   */
  isolated?: boolean;
}

/**
 * Paginated designs fetch for the infinite-scroll gallery (see
 * `CategoryGallery.tsx`) — the point-server route returns `{ items, total }`
 * whenever `offset`/`limit` are present, as opposed to the plain array
 * `fetchDesigns` gets back (docs/PLAN.md Этап 3).
 *
 * `category` is optional so the operator panel's "Изолированные" filter can
 * fetch isolated designs across every category at once.
 */
export async function fetchDesignsPage(
  category: DesignCategory | undefined,
  { search, offset, limit, isolated }: FetchDesignsPageOptions,
): Promise<DesignsPage> {
  const url = new URL(`${POINT_SERVER_URL}/catalog/designs`);
  if (category) {
    url.searchParams.set("category", category);
  }
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  if (search) {
    url.searchParams.set("search", search);
  }
  if (isolated !== undefined) {
    url.searchParams.set("isolated", String(isolated));
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch designs page: ${res.status}`);
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

/**
 * Home page "Популярные принты" banner — highest use-count designs across
 * every category, capped per-category server-side (see
 * `selectPopularDesigns` in point-server). `limit` defaults to
 * `POPULAR_DESIGNS_DEFAULT_LIMIT` on the server when omitted.
 */
export async function fetchPopularDesigns(limit?: number): Promise<Design[]> {
  const url = new URL(`${POINT_SERVER_URL}/catalog/designs/popular`);
  if (limit) {
    url.searchParams.set("limit", String(limit));
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch popular designs: ${res.status}`);
  }
  return res.json();
}

/**
 * Bumps a design's use count by one — call once a print order using it is
 * successfully created (see `Editor.tsx` `handlePrint`). Fire-and-forget from
 * the caller's point of view: a failed bump shouldn't block or roll back an
 * order that already went through (fail-open).
 */
export async function markDesignUsed(id: string): Promise<Design> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/designs/${id}/use`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to mark design ${id} as used: ${res.status}`);
  }
  return res.json();
}

export async function deleteDesign(id: string): Promise<void> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/designs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete design ${id}: ${res.status}`);
  }
}

/**
 * "Изолировать"/"Вернуть" toggle from the operator's Designs → Галерея tab —
 * hides (or restores) a design from the kiosk gallery without deleting it.
 */
export async function setDesignIsolated(id: string, isolated: boolean): Promise<Design> {
  const body: SetDesignIsolatedInput = { isolated };
  const res = await fetch(`${POINT_SERVER_URL}/catalog/designs/${id}/isolate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to set isolated for design ${id}: ${res.status}`);
  }
  return res.json();
}

/** Bulk "clear category" for the operator's Designs → Галерея tab — deletes every design (+ file) in one category. */
export async function deleteDesignsByCategory(category: DesignCategory): Promise<number> {
  const url = new URL(`${POINT_SERVER_URL}/catalog/designs`);
  url.searchParams.set("category", category);
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete category designs: ${res.status}`);
  }
  const body = (await res.json()) as { deleted: number };
  return body.deleted;
}

/** Brief backoff before retrying — covers the ~1-2s window where point-server is mid-restart (e.g. `tsx watch` reloading after a code change) rather than genuinely down. */
const CREATE_ORDER_RETRY_DELAYS_MS = [300, 900];

/**
 * `fetch` rejecting outright (network error/connection refused) means the
 * point-server process itself isn't reachable yet — worth a couple of quick
 * retries, since on a kiosk that's overwhelmingly a brief restart window
 * rather than a real outage. An HTTP error *response* (4xx/5xx) means the
 * server answered fine and the request itself was bad, so that's surfaced
 * immediately instead.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const body = JSON.stringify(input);
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt <= CREATE_ORDER_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(`${POINT_SERVER_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        throw new Error(`Failed to create order: ${res.status}`);
      }
      return res.json();
    } catch (err) {
      // `TypeError` here is fetch's generic "network error" (DNS/refused/reset) —
      // anything else (including our own `Error` above for non-2xx responses)
      // means the server responded, so don't retry those.
      if (!(err instanceof TypeError) || attempt === CREATE_ORDER_RETRY_DELAYS_MS.length) {
        throw err;
      }
      lastNetworkError = err;
      await new Promise((resolve) => setTimeout(resolve, CREATE_ORDER_RETRY_DELAYS_MS[attempt]));
    }
  }

  // Unreachable in practice — the loop above always returns or throws — but
  // keeps TypeScript happy about every code path returning/throwing.
  throw lastNetworkError instanceof Error ? lastNetworkError : new Error("Failed to create order");
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

// --- Point config + pricing (Этап 7: cached from central-relay's `sync:snapshot`) ---

/** Cached name/status/uploadMode — kiosk gates checkout on `status` (see `pointStatusStore.ts`). */
export async function fetchPointConfig(): Promise<PointConfigSnapshot> {
  const res = await fetch(`${POINT_SERVER_URL}/point-config`);
  if (!res.ok) {
    throw new Error(`Failed to fetch point config: ${res.status}`);
  }
  return res.json();
}

/** Effective (global + point override) price config, cached on point-server from the last sync. */
export async function fetchPriceConfig(): Promise<PriceConfig> {
  const res = await fetch(`${POINT_SERVER_URL}/pricing`);
  if (!res.ok) {
    throw new Error(`Failed to fetch price config: ${res.status}`);
  }
  return res.json();
}

/** Realtime push whenever point-server applies a fresh `sync:snapshot` — lets the kiosk react to "closed" without polling. */
export function subscribePointConfigEvents(callback: (config: PointConfigSnapshot) => void): () => void {
  const socket = getSocket();
  const handler = (payload: PointConfigSnapshot) => callback(payload);
  socket.on(POINT_CONFIG_EVENT_CHANNEL, handler);
  return () => {
    socket.off(POINT_CONFIG_EVENT_CHANNEL, handler);
  };
}

/** Realtime push whenever point-server applies a fresh price config — lets the editor's live price update without a reload. */
export function subscribePricingEvents(callback: (config: PriceConfig) => void): () => void {
  const socket = getSocket();
  const handler = (payload: PriceConfig) => callback(payload);
  socket.on(PRICING_EVENT_CHANNEL, handler);
  return () => {
    socket.off(PRICING_EVENT_CHANNEL, handler);
  };
}

// --- Pinterest catalog scraper (Этап 3) — settings tab in the operator panel ---

export interface PrintAreaConfigResponse {
  areas: PrintAreaConfig;
  updatedAt: string;
}

export async function fetchPrintAreaConfig(): Promise<PrintAreaConfigResponse> {
  const res = await fetch(`${POINT_SERVER_URL}/print-area-config`);
  if (!res.ok) {
    throw new Error(`Failed to fetch print area config: ${res.status}`);
  }
  return res.json();
}

export async function updatePrintAreaConfig(input: UpdatePrintAreaConfigInput): Promise<PrintAreaConfigResponse> {
  const res = await fetch(`${POINT_SERVER_URL}/print-area-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to update print area config: ${res.status}`);
  }
  return res.json();
}

export async function fetchScrapeConfig(): Promise<CatalogScrapeConfig> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/scrape-config`);
  if (!res.ok) {
    throw new Error(`Failed to fetch scrape config: ${res.status}`);
  }
  return res.json();
}

export async function updateScrapeConfig(input: UpdateCatalogScrapeConfigInput): Promise<CatalogScrapeConfig> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/scrape-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to update scrape config: ${res.status}`);
  }
  return res.json();
}

export async function testGiphyApiKey(apiKey?: string): Promise<GiphyApiKeyTestResult> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/scrape-config/giphy/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apiKey != null && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to test Giphy API key: ${res.status}`);
  }
  return res.json();
}

export async function fetchScrapeStatus(): Promise<CatalogScrapeStatus[]> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/scrape-status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch scrape status: ${res.status}`);
  }
  return res.json();
}

/** Disk-usage snapshot for the "Обзор" tab — GB limit + per-category breakdown (docs/PLAN.md "кэш картинок по ГБ"). */
export async function fetchCacheUsage(): Promise<CatalogCacheUsage> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/cache-usage`);
  if (!res.ok) {
    throw new Error(`Failed to fetch cache usage: ${res.status}`);
  }
  return res.json();
}

export async function triggerScrapeRun(category: GalleryCategory): Promise<void> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/scrape/${category}/run`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to trigger scrape run: ${res.status}`);
  }
}

export async function fetchQueryTags(): Promise<CategoryQueryTags[]> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/query-tags`);
  if (!res.ok) {
    throw new Error(`Failed to fetch query tags: ${res.status}`);
  }
  return res.json();
}

export async function updateQueryTags(category: GalleryCategory, tags: string[]): Promise<CategoryQueryTags> {
  const res = await fetch(`${POINT_SERVER_URL}/catalog/query-tags/${category}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update query tags: ${res.status}`);
  }
  return res.json();
}

// --- ИИ-раздел (Этап 9) ---

export async function fetchAiStyles(): Promise<AiStyle[]> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/styles`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI styles: ${res.status}`);
  }
  return res.json();
}

/** Mints a QR photo-upload session — point-server picks `relay`/`wifi` based on the synced `uploadMode` (see `modules/ai/routes.ts`). */
export async function createAiUploadSession(): Promise<CreateAiUploadSessionResponse> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/upload-session`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to create upload session: ${res.status}`);
  }
  return res.json();
}

/** Sends the raw photo + chosen style to point-server, which calls Pollinations (requires internet, see docs/PLAN.md). */
export async function stylizeAiPhoto(imageBase64: string, styleKey: string): Promise<StylizeResponse> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/stylize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, styleKey }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to stylize photo: ${res.status}`);
  }
  return res.json();
}

/** Fires once a phone photo arrives for the currently-displayed QR session, regardless of `relay`/`wifi` mode (see `AiQrUpload.tsx`). */
export function subscribeAiPhotoReceived(callback: (payload: AiPhotoReceivedPayload) => void): () => void {
  const socket = getSocket();
  const handler = (payload: AiPhotoReceivedPayload) => callback(payload);
  socket.on(AI_PHOTO_RECEIVED_EVENT, handler);
  return () => {
    socket.off(AI_PHOTO_RECEIVED_EVENT, handler);
  };
}

// --- "ИИ-стили" operator panel — CRUD over the ai_styles catalog (hybrid Pollinations + local stylization) ---

export async function fetchAiStylesAdmin(): Promise<AiStyleAdmin[]> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/styles/admin`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI styles (admin): ${res.status}`);
  }
  return res.json();
}

export async function createAiStyle(input: CreateAiStyleInput): Promise<AiStyleAdmin> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/styles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : `Failed to create AI style: ${res.status}`);
  }
  return res.json();
}

export async function updateAiStyle(id: number, input: UpdateAiStyleInput): Promise<AiStyleAdmin> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/styles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to update AI style ${id}: ${res.status}`);
  }
  return res.json();
}

export async function deleteAiStyle(id: number): Promise<void> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/styles/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete AI style ${id}: ${res.status}`);
  }
}

export async function regenerateAiStylePreview(id: number): Promise<void> {
  const res = await fetch(`${POINT_SERVER_URL}/ai/styles/${id}/regenerate-preview`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to regenerate AI style preview: ${res.status}`);
  }
}
