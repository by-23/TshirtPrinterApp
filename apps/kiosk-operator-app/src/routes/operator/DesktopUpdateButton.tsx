import { useEffect, useState } from "react";
import {
  installDesktopUpdate,
  subscribeDesktopUpdate,
  type DesktopUpdateStatus,
} from "../../lib/desktopUpdate.js";
import { isPointDesktop } from "../../lib/pointDesktop.js";

/**
 * Stays visible once an update is downloading / ready until the operator
 * clicks Install. Download starts automatically in the Electron shell.
 */
export function DesktopUpdateButton() {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);

  useEffect(() => {
    if (!isPointDesktop()) return;
    return subscribeDesktopUpdate(setStatus);
  }, []);

  if (!isPointDesktop() || !status) return null;
  if (status.state !== "downloading" && status.state !== "ready" && status.state !== "installing") {
    return null;
  }

  const versionLabel = status.version ? ` v${status.version}` : "";
  const busy = status.state === "downloading" || status.state === "installing";
  const label =
    status.state === "downloading"
      ? `Скачивание${versionLabel}${status.percent != null ? ` ${status.percent}%` : "…"}`
      : status.state === "installing"
        ? "Установка…"
        : `Обновить${versionLabel}`;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (busy) return;
        void installDesktopUpdate();
      }}
      title={
        status.state === "ready"
          ? "Обновление скачано. Нажмите, чтобы установить и перезапустить приложение."
          : "Обновление скачивается в фоне"
      }
      className="flex items-center gap-2 rounded-full font-bold transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-80"
      style={{
        fontSize: "var(--operator-statsbar-printer-font-size)",
        padding: "var(--operator-statsbar-printer-padding-y) var(--operator-statsbar-printer-padding-x)",
        backgroundColor: status.state === "ready" ? "#2563eb" : "#1e3a5f",
        color: "#ffffff",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {label}
    </button>
  );
}
