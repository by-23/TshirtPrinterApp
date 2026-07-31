import type { Order } from "@tshirt/shared-types";
import { StatusBadge } from "./StatusBadge.js";
import { OrderImage } from "./OrderImage.js";
import { GARMENT_TYPE_LABELS, GARMENT_SIDE_LABELS, formatOrderTime, formatPrice, garmentColorLabel } from "./orderLabels.js";

export function OrderListItem({
  order,
  isSelected,
  onSelect,
}: {
  order: Order;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const garmentLine = `${GARMENT_TYPE_LABELS[order.garment.type]} ${garmentColorLabel(order.garment.color)}, ${order.garment.size}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center text-left transition-colors"
      style={{
        gap: "var(--operator-item-content-gap)",
        padding: "var(--operator-item-padding-y) var(--operator-item-padding-x)",
        borderRadius: "var(--operator-item-radius)",
        backgroundColor: isSelected ? "var(--operator-accent-soft)" : "transparent",
        border: `1px solid ${isSelected ? "var(--operator-accent)" : "transparent"}`,
      }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center overflow-hidden"
        style={{
          width: "var(--operator-item-thumb-size)",
          height: "var(--operator-item-thumb-size)",
          borderRadius: "var(--operator-item-thumb-radius)",
          backgroundColor: "var(--operator-card-bg)",
          border: "1px solid var(--operator-card-border)",
        }}
      >
        <OrderImage
          src={order.mockupImageUrl}
          className="h-full w-full object-cover"
          iconStyle={{
            width: "var(--operator-item-thumb-icon-size)",
            height: "var(--operator-item-thumb-icon-size)",
            color: "var(--operator-text-muted)",
          }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-white" style={{ fontSize: "var(--operator-item-number-size)" }}>
            №{order.id}
          </span>
          <span style={{ fontSize: "var(--operator-item-time-size)", color: "var(--operator-text-muted)" }}>
            {formatOrderTime(order.createdAt)}
          </span>
        </div>
        <span className="truncate" style={{ fontSize: "var(--operator-item-detail-size)", color: "var(--operator-text-muted)" }}>
          {garmentLine} · 1 дизайн · {GARMENT_SIDE_LABELS[order.side]}
        </span>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            {order.printCount > 0 && (
              <span style={{ fontSize: "var(--operator-item-time-size)", color: "var(--operator-text-muted)" }}>
                ×{order.printCount}
              </span>
            )}
          </div>
          <span className="font-bold text-white" style={{ fontSize: "var(--operator-item-price-size)" }}>
            {formatPrice(order.price)}
          </span>
        </div>
      </div>
    </button>
  );
}
