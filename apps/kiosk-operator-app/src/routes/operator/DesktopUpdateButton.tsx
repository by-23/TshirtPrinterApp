import { useEffect, useState, type CSSProperties } from "react";
import {
  checkDesktopUpdate,
  installDesktopUpdate,
  subscribeDesktopUpdate,
  type DesktopUpdateStatus,
} from "../../lib/desktopUpdate.js";
import {
  applyModulePipeline,
  checkModuleUpdates,
  subscribeModuleUpdates,
  type ModuleZoneStatus,
  type ModulesUpdateSnapshot,
} from "../../lib/moduleUpdate.js";
import { isPointDesktop } from "../../lib/pointDesktop.js";

const btnBase: CSSProperties = {
  fontSize: "var(--operator-statsbar-printer-font-size)",
  padding: "var(--operator-statsbar-printer-padding-y) var(--operator-statsbar-printer-padding-x)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.12)",
};

const ZONE_LABEL: Record<string, string> = {
  ui: "интерфейс",
  server: "сервер",
  shell: "оболочку",
};

function activeZone(modules: ModulesUpdateSnapshot | null, shell: DesktopUpdateStatus | null): {
  id: string;
  state: string;
  percent?: number;
  phase?: string;
  error?: string;
} | null {
  for (const z of modules?.zones ?? []) {
    if (z.state === "downloading" || z.state === "applying" || z.state === "checking") {
      return {
        id: z.id,
        state: z.state,
        percent: z.percent,
        phase: (z as ModuleZoneStatus & { phase?: string }).phase,
        error: z.error,
      };
    }
  }
  if (shell && (shell.state === "downloading" || shell.state === "installing" || shell.state === "checking")) {
    return { id: "shell", state: shell.state, percent: shell.percent, error: shell.error };
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label}: таймаут ${Math.round(ms / 1000)}с`)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Single updates control for Operator desktop.
 * One click: check → apply ui → server → shell, with live progress.
 */
export function DesktopUpdateButton() {
  const [shell, setShell] = useState<DesktopUpdateStatus | null>(null);
  const [modules, setModules] = useState<ModulesUpdateSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPointDesktop()) return;
    const offShell = subscribeDesktopUpdate(setShell);
    const offModules = subscribeModuleUpdates(setModules);
    return () => {
      offShell();
      offModules();
    };
  }, []);

  if (!isPointDesktop()) return null;

  const uiZone = modules?.zones.find((z) => z.id === "ui");
  const serverZone = modules?.zones.find((z) => z.id === "server");
  const shellReady = shell?.state === "ready";
  const uiReady = uiZone?.state === "ready";
  const serverReady = serverZone?.state === "ready";
  const active = activeZone(modules, shell);
  const downloading = Boolean(active);
  const hasError = Boolean(lastError || shell?.error || uiZone?.error || serverZone?.error || modules?.error);
  const readyCount = [shellReady, uiReady, serverReady].filter(Boolean).length;

  const title = [
    shell?.version ? `Оболочка ${shell.version}` : null,
    uiZone?.localVersion ? `Интерфейс ${uiZone.localVersion}` : null,
    serverZone?.localVersion ? `Сервер ${serverZone.localVersion}` : null,
    lastError,
    shell?.error,
    uiZone?.error,
    serverZone?.error,
    modules?.error,
  ]
    .filter(Boolean)
    .join(" · ");

  let label = "Обновления";
  let bg = "#1e3a5f";
  if (busy || downloading) {
    const zoneName = active ? ZONE_LABEL[active.id] || active.id : null;
    const pct =
      active?.percent != null
        ? ` ${active.percent}%`
        : shell?.percent != null
          ? ` ${shell.percent}%`
          : uiZone?.percent != null
            ? ` ${uiZone.percent}%`
            : serverZone?.percent != null
              ? ` ${serverZone.percent}%`
              : "";
    if (phaseLabel) {
      label = phaseLabel;
    } else if (active?.state === "checking" || (!active && busy)) {
      label = "Проверка…";
    } else if (active?.state === "downloading") {
      label = `Скачивание ${zoneName || ""}${pct}`.trim();
    } else if (active?.phase === "extract") {
      label = `Распаковка ${zoneName || ""}…`.trim();
    } else if (active?.phase === "stopping-server" || active?.phase === "restart") {
      label = "Перезапуск сервера…";
    } else if (active?.state === "applying" || active?.state === "installing") {
      label = `Установка ${zoneName || ""}${pct}`.trim();
    } else {
      label = "Обновление…";
    }
    bg = "#1e3a5f";
  } else if (readyCount > 0) {
    label = readyCount === 1 ? "Установить обновление" : `Установить обновления (${readyCount})`;
    bg = "#2563eb";
  } else if (hasError) {
    label = "Ошибка обновления";
    bg = "#7f1d1d";
  }

  async function runPipeline() {
    setBusy(true);
    setLastError(null);
    try {
      let nextShell = shell;
      let nextModules = modules;

      if (!uiReady && !serverReady && !shellReady) {
        setPhaseLabel("Проверка…");
        const [shellRes, modulesRes] = await Promise.all([
          withTimeout(checkDesktopUpdate(), 60_000, "Проверка оболочки"),
          withTimeout(checkModuleUpdates(), 60_000, "Проверка модулей"),
        ]);
        if (shellRes.status) nextShell = shellRes.status;
        if (modulesRes.status) {
          nextModules = modulesRes.status;
          setModules(modulesRes.status);
        }
        if (shellRes.status) setShell(shellRes.status);
      }

      const zoneList = nextModules?.zones ?? modules?.zones ?? [];
      const ui = zoneList.find((z) => z.id === "ui");
      const server = zoneList.find((z) => z.id === "server");
      const needUi = ui?.state === "ready" || uiReady;
      const needServer = server?.state === "ready" || serverReady;
      const needShell = nextShell?.state === "ready" || shell?.state === "ready" || shellReady;

      if (!needUi && !needServer && !needShell) {
        setPhaseLabel(null);
        return;
      }

      // Shell first: module apply used to hang on server swap and block the shell forever.
      if (needShell) {
        setPhaseLabel("Перезапуск для установки оболочки…");
        const res = await installDesktopUpdate();
        if (!res.ok) throw new Error(res.error || "не удалось установить оболочку");
        return;
      }

      const toApply: Array<"ui" | "server"> = [];
      if (needUi) toApply.push("ui");
      if (needServer) toApply.push("server");
      if (toApply.length) {
        setPhaseLabel(
          toApply.length === 2
            ? "Установка модулей…"
            : toApply[0] === "ui"
              ? "Установка интерфейса…"
              : "Установка сервера…",
        );
        const res = await withTimeout(applyModulePipeline(toApply), 25 * 60_000, "Установка модулей");
        if (!res.ok) throw new Error(res.error || "не удалось установить модули");
        if (res.status) setModules(res.status);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastError(message);
    } finally {
      setPhaseLabel(null);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy || downloading}
      onClick={() => void runPipeline()}
      title={title || "Проверить и установить обновления"}
      style={{ ...btnBase, backgroundColor: bg }}
      className="flex items-center gap-2 rounded-full font-bold transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-80"
    >
      {label}
    </button>
  );
}
