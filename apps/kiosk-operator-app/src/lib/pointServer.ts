import type { Design, DesignCategory } from "@tshirt/shared-types";

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
