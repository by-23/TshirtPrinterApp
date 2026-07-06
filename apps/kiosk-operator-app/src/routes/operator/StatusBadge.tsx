import type { OrderStatus } from "@tshirt/shared-types";
import { STATUS_PRESENTATION } from "./orderLabels.js";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const { label, bg, fg } = STATUS_PRESENTATION[status];
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide ${className ?? ""}`}
      style={{
        fontSize: "var(--operator-badge-font-size)",
        padding: "var(--operator-badge-padding-y) var(--operator-badge-padding-x)",
        borderRadius: "var(--operator-badge-radius)",
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}
