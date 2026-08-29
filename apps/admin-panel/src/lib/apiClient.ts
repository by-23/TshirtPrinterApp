import { useAuthStore } from "./authStore.js";

const configuredBase = import.meta.env.VITE_CENTRAL_RELAY_URL as string | undefined;
/** Same host as the panel in production; local Vite still talks to the relay on 4100. */
export const BASE_URL =
  configuredBase && configuredBase.length > 0
    ? configuredBase
    : import.meta.env.DEV
      ? "http://localhost:4100"
      : "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (body.error) {
      return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    }
  } catch {
    // response wasn't JSON — fall through to statusText
  }
  return response.statusText;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  // Skip for FormData bodies — the browser must set its own multipart boundary.
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    useAuthStore.getState().logout();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Multipart upload (no JSON content-type — the browser sets the boundary itself). */
  uploadFile: async <T>(path: string, file: File | Blob): Promise<T> => {
    const formData = new FormData();
    formData.append("file", file);
    return request<T>(path, { method: "POST", body: formData });
  },
  /**
   * Multipart upload with arbitrary FormData fields (font uploads need
   * `label` / `familyName` alongside the binary).
   */
  uploadForm: async <T>(path: string, formData: FormData): Promise<T> => {
    return request<T>(path, { method: "POST", body: formData });
  },
  /**
   * Fetches a protected binary (the manual catalog's `GET
   * /catalog-manual/:id/file`) with the admin's Bearer token attached — an
   * `<img src>` can't carry an Authorization header itself, so callers turn
   * this into an object URL instead (see `CatalogPage.tsx`).
   */
  getBlob: async (path: string): Promise<Blob> => {
    const token = useAuthStore.getState().token;
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${BASE_URL}${path}`, { headers });
    if (response.status === 401) {
      useAuthStore.getState().logout();
    }
    if (!response.ok) {
      throw new ApiError(response.status, await parseErrorBody(response));
    }
    return response.blob();
  },
};
