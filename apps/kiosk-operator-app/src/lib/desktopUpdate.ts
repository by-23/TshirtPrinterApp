export type DesktopUpdateStatus = {
  state: "idle" | "checking" | "downloading" | "ready" | "installing" | "error" | string;
  version?: string;
  percent?: number;
  error?: string;
};

type UpdateApi = {
  getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
  installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
};

function getUpdateApi(): UpdateApi | null {
  if (typeof window === "undefined") return null;
  const desktop = window.pointDesktop as UpdateApi | undefined;
  if (desktop?.getUpdateStatus) return desktop;
  return null;
}

export function subscribeDesktopUpdate(onStatus: (status: DesktopUpdateStatus) => void): () => void {
  const api = getUpdateApi();
  if (!api?.getUpdateStatus) return () => undefined;

  let cancelled = false;
  void api.getUpdateStatus().then((status) => {
    if (!cancelled) onStatus(status);
  });

  const unsubscribe = api.onUpdateStatus?.(onStatus);
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function installDesktopUpdate(): Promise<{ ok: boolean; error?: string }> {
  const api = getUpdateApi();
  if (!api?.installUpdate) return { ok: false, error: "not desktop" };
  return api.installUpdate();
}
