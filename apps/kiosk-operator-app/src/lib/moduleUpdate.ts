export type ModuleZoneId = "ui" | "server" | "runtime";

export type ModuleZoneStatus = {
  id: ModuleZoneId;
  localVersion?: string;
  remoteVersion?: string;
  state: "idle" | "checking" | "downloading" | "ready" | "applying" | "error" | string;
  percent?: number;
  phase?: string;
  error?: string;
};

export type ModulesUpdateSnapshot = {
  zones: ModuleZoneStatus[];
  error?: string;
};

type ModulesApi = {
  getModulesStatus?: () => Promise<ModulesUpdateSnapshot>;
  checkModuleUpdates?: () => Promise<{ ok: boolean; error?: string; status?: ModulesUpdateSnapshot }>;
  applyModuleUpdate?: (zone: ModuleZoneId) => Promise<{ ok: boolean; error?: string }>;
  onModulesStatus?: (callback: (status: ModulesUpdateSnapshot) => void) => () => void;
};

function getModulesApi(): ModulesApi | null {
  if (typeof window === "undefined") return null;
  return (window.pointDesktop as ModulesApi | undefined) ?? null;
}

export function subscribeModuleUpdates(onStatus: (status: ModulesUpdateSnapshot) => void): () => void {
  const api = getModulesApi();
  if (!api?.getModulesStatus) return () => undefined;

  let cancelled = false;
  void api.getModulesStatus().then((status) => {
    if (!cancelled) onStatus(status);
  });

  const unsubscribe = api.onModulesStatus?.(onStatus);
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function checkModuleUpdates(): Promise<{
  ok: boolean;
  error?: string;
  status?: ModulesUpdateSnapshot;
}> {
  const api = getModulesApi();
  if (!api?.checkModuleUpdates) return { ok: false, error: "not desktop" };
  return api.checkModuleUpdates();
}

export async function applyModuleUpdate(zone: ModuleZoneId): Promise<{ ok: boolean; error?: string }> {
  const api = getModulesApi();
  if (!api?.applyModuleUpdate) return { ok: false, error: "not desktop" };
  return api.applyModuleUpdate(zone);
}
