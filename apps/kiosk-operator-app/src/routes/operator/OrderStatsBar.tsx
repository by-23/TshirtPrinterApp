import { CircleCheck } from "../../components/icons.js";

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

      <div
        className="ml-auto flex items-center gap-2 rounded-full font-semibold"
        style={{
          fontSize: "var(--operator-statsbar-printer-font-size)",
          padding: "var(--operator-statsbar-printer-padding-y) var(--operator-statsbar-printer-padding-x)",
          backgroundColor: "var(--operator-statsbar-printer-bg)",
          color: "var(--operator-statsbar-printer-color)",
        }}
      >
        <CircleCheck style={{ width: "var(--operator-statsbar-printer-icon-size)", height: "var(--operator-statsbar-printer-icon-size)" }} />
        Принтер готов · Все системы работают
      </div>
    </header>
  );
}
