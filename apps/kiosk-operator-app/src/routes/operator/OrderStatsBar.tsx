import { useEffect, useState } from "react";
import { CircleCheck } from "../../components/icons.js";
import { fetchLanInfo } from "../../lib/pointServer.js";

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

/**
 * Top status bar from `docs/ui-mockups/operator.png` — order counters + a
 * static "printer ready" pill. Sizes/spacing are `--operator-statsbar-*`
 * CSS tokens, live tunable via `OperatorThemePanel`.
 */
export function OrderStatsBar({ counts }: { counts: OrderCounts }) {
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
        <LanEndpointChip />
        <div
          className="flex items-center gap-2 rounded-full font-semibold"
          style={{
            fontSize: "var(--operator-statsbar-printer-font-size)",
            padding: "var(--operator-statsbar-printer-padding-y) var(--operator-statsbar-printer-padding-x)",
            backgroundColor: "var(--operator-statsbar-printer-bg)",
            color: "var(--operator-statsbar-printer-color)",
          }}
        >
          <CircleCheck
            style={{
              width: "var(--operator-statsbar-printer-icon-size)",
              height: "var(--operator-statsbar-printer-icon-size)",
            }}
          />
          Принтер готов · Все системы работают
        </div>
      </div>
    </header>
  );
}
