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
