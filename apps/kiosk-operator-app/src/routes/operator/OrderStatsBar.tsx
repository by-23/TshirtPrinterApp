import { useEffect, useState } from "react";
import { CircleCheck } from "../../components/icons.js";
import { fetchLanInfo, fetchPrinterStatus, type WindowsPrinterHealth } from "../../lib/pointServer.js";
import { DesktopUpdateButton } from "./DesktopUpdateButton.js";

export interface OrderCounts {
  new: number;
  inProgress: number;
  done: number;
  total: number;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl"
      style={{
        padding: "var(--operator-statsbar-card-padding-y) var(--operator-statsbar-card-padding-x)",
        backgroundColor: "var(--operator-card-bg)",
        border: "1px solid var(--operator-card-border)",
      }}
    >
      <span className="font-extrabold" style={{ fontSize: "var(--operator-statsbar-card-value-size)", color }}>
        {value}
      </span>
      <span
        className="font-bold uppercase tracking-wide"
        style={{ fontSize: "var(--operator-statsbar-card-label-size)", color: "var(--operator-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

function resolveEndpointLabel(info: Awaited<ReturnType<typeof fetchLanInfo>>): string {
  const preferred =
    info.kioskUrls.find((u) => !/vethernet|wsl|hyper-v|docker|vmware|vbox/i.test(u.interfaceName)) ??
    info.kioskUrls[0] ??
    null;
  const host = preferred?.host ?? info.preferredHost;
  if (host) return `${host}:${info.port}`;
  const { hostname, port } = window.location;
  return port ? `${hostname}:${port}` : `${hostname}:4000`;
}

function LanEndpointChip() {
  const [endpoint, setEndpoint] = useState(() => {
    const { hostname, port } = window.location;
    return port ? `${hostname}:${port}` : `${hostname}:4000`;
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLanInfo()
      .then((info) => {
        if (!cancelled) setEndpoint(resolveEndpointLabel(info));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Скопировать IP:порт для киоска"
      className="flex items-center gap-2 rounded-full font-semibold transition-opacity hover:opacity-90"
      style={{
        fontSize: "var(--operator-statsbar-printer-font-size)",
        padding: "var(--operator-statsbar-printer-padding-y) var(--operator-statsbar-printer-padding-x)",
        backgroundColor: "var(--operator-card-bg)",
        border: "1px solid var(--operator-card-border)",
        color: "#ffffff",
      }}
    >
      <span style={{ color: "var(--operator-text-muted)" }}>Киоск</span>
      <span className="font-mono tracking-wide">{copied ? "Скопировано" : endpoint}</span>
    </button>
  );
}

function printerPillStyle(health: WindowsPrinterHealth | null): { bg: string; color: string; label: string } {
  if (health === "ready") {
    return {
      bg: "var(--operator-statsbar-printer-bg)",
      color: "var(--operator-statsbar-printer-color)",
      label: "Принтер готов · Windows OK",
    };
  }
  if (health === "busy") {
    return { bg: "rgba(245, 166, 35, 0.2)", color: "#f5a623", label: "Принтер занят" };
  }
  if (health === "offline" || health === "error" || health === "not_found") {
    return {
      bg: "rgba(248, 113, 113, 0.18)",
      color: "#f87171",
      label: health === "not_found" ? "Принтер не найден в Windows" : "Принтер недоступен",
    };
  }
  return {
    bg: "var(--operator-card-bg)",
    color: "var(--operator-text-muted)",
    label: "Статус принтера…",
  };
}

/** Top status bar — order counters + live Windows printer status. */
export function OrderStatsBar({ counts }: { counts: OrderCounts }) {
  const [printerHealth, setPrinterHealth] = useState<WindowsPrinterHealth | null>(null);
  const [printerSummary, setPrinterSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const status = await fetchPrinterStatus();
        if (cancelled) return;
        setPrinterHealth(status.windows.health);
        setPrinterSummary(status.summary);
      } catch {
        if (!cancelled) {
          setPrinterHealth("unknown");
          setPrinterSummary(null);
        }
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const pill = printerPillStyle(printerHealth);

  return (
    <header
      className="flex flex-shrink-0 flex-wrap items-center border-b"
      style={{
        gap: "var(--operator-statsbar-gap)",
        padding: "var(--operator-statsbar-padding-y) var(--operator-statsbar-padding-x)",
        borderColor: "var(--operator-card-border)",
      }}
    >
      <div
        className="flex items-center gap-2.5 rounded-full bg-white font-bold text-black"
        style={{
          fontSize: "var(--operator-statsbar-pill-font-size)",
          padding: "var(--operator-statsbar-pill-padding-y) var(--operator-statsbar-pill-padding-x)",
        }}
      >
        Заказы
        <span
          className="flex items-center justify-center rounded-full font-bold text-white"
          style={{
            minWidth: "var(--operator-statsbar-badge-size)",
            height: "var(--operator-statsbar-badge-size)",
            fontSize: "var(--operator-statsbar-badge-font-size)",
            paddingInline: "6px",
            backgroundColor: "var(--operator-accent)",
          }}
        >
          {counts.total}
        </span>
      </div>

      <StatCard label="Новые" value={counts.new} color="#ff5f9e" />
      <StatCard label="В работе" value={counts.inProgress} color="#f5a623" />
      <StatCard label="Готовы" value={counts.done} color="#2ecc71" />
      <StatCard label="Всего заказов" value={counts.total} color="#ffffff" />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DesktopUpdateButton />
        <LanEndpointChip />
        <div
          className="flex items-center gap-2 rounded-full font-semibold"
          title={printerSummary ?? undefined}
          style={{
            fontSize: "var(--operator-statsbar-printer-font-size)",
            padding: "var(--operator-statsbar-printer-padding-y) var(--operator-statsbar-printer-padding-x)",
            backgroundColor: pill.bg,
            color: pill.color,
          }}
        >
          <CircleCheck
            style={{
              width: "var(--operator-statsbar-printer-icon-size)",
              height: "var(--operator-statsbar-printer-icon-size)",
            }}
          />
          {pill.label}
        </div>
      </div>
    </header>
  );
}
