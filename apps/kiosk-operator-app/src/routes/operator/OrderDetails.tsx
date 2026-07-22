import { useState } from "react";
import type { Order } from "@tshirt/shared-types";
import { TshirtIcon } from "../../components/icons.js";
import { updateOrderStatus } from "../../lib/pointServer.js";
import { printOrderDesign } from "../../lib/printOrder.js";
import { StatusBadge } from "./StatusBadge.js";
import {
  FABRIC_LABELS,
  GARMENT_SIDE_LABELS,
  GARMENT_TYPE_LABELS,
  formatOrderDate,
  formatOrderTime,
  formatPrice,
  garmentColorLabel,
} from "./orderLabels.js";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ fontSize: "var(--operator-details-row-font-size)" }}>
      <span style={{ color: "var(--operator-text-muted)" }}>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export function OrderDetails({ order: orderProp, onUpdated }: { order: Order | null; onUpdated: (order: Order) => void }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!orderProp) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center text-lg" style={{ color: "var(--operator-text-muted)" }}>
        Выберите заказ из списка слева
      </div>
    );
  }

  // Rebound as a plain local const (rather than relying on narrowing of the
  // `orderProp` parameter) so TypeScript keeps it non-null inside the
  // `applyStatus` closure below.
  const order = orderProp;

  const isNew = order.status === "new";
  const isInProgress = order.status === "accepted" || order.status === "printing";
  const isFinal = order.status === "done" || order.status === "cancelled";

  async function applyStatus(status: "accepted" | "done" | "cancelled") {
    if (status === "cancelled" && !window.confirm(`Отменить заказ №${order.id}?`)) return;
    if (status === "accepted" && isFinal) {
      const message =
        order.status === "cancelled"
          ? `Заказ №${order.id} отменён. Отправить на печать повторно?`
          : `Заказ №${order.id} уже выполнен. Отправить на печать повторно?`;
      if (!window.confirm(message)) return;
    }
    setError(null);
    setIsUpdating(true);
    try {
      if (status === "accepted") {
        if (!order.designImageUrl) {
          throw new Error("no design");
        }
        await printOrderDesign(order.designImageUrl, `Заказ №${order.id}`);
      }
      const updated = await updateOrderStatus(order.id, status);
      onUpdated(updated);
    } catch {
      setError(
        status === "accepted"
          ? "Не удалось отправить на печать. Проверьте файл дизайна и попробуйте ещё раз."
          : "Не удалось обновить заказ. Попробуйте ещё раз.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div
      className="app-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
      style={{ padding: "var(--operator-details-padding-y) var(--operator-details-padding-x)" }}
    >
      <div className="mb-4 flex flex-shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-extrabold text-white" style={{ fontSize: "var(--operator-details-title-size)" }}>
            Заказ №{order.id}
          </h2>
          <StatusBadge status={order.status} />
        </div>
        <span style={{ fontSize: "var(--operator-details-meta-size)", color: "var(--operator-text-muted)" }}>
          {formatOrderTime(order.createdAt)} · {formatOrderDate(order.createdAt)}
        </span>
      </div>

      <div
        className="grid flex-shrink-0"
        style={{ gridTemplateColumns: "var(--operator-details-columns)", gap: "var(--operator-details-columns-gap)" }}
      >
        <div className="flex flex-col">
          <div className="mb-4 flex items-center justify-center gap-3">
            {(["front", "back"] as const).map((side) => (
              <span
                key={side}
                className="rounded-full font-bold uppercase tracking-wide"
                style={{
                  fontSize: "var(--operator-details-side-font-size)",
                  padding: "var(--operator-details-side-padding-y) var(--operator-details-side-padding-x)",
                  backgroundColor: side === order.side ? "var(--operator-accent)" : "var(--operator-card-bg)",
                  color: side === order.side ? "#fff" : "var(--operator-text-muted)",
                  border: "1px solid var(--operator-card-border)",
                }}
              >
                {GARMENT_SIDE_LABELS[side]}
              </span>
            ))}
          </div>

          <div
            className="flex flex-1 items-center justify-center"
            style={{
              borderRadius: "var(--operator-details-preview-radius)",
              paddingBlock: "var(--operator-details-preview-padding-y)",
              backgroundColor: "var(--operator-card-bg)",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            {order.mockupImageUrl ? (
              <img
                src={order.mockupImageUrl}
                alt={`Мокап заказа №${order.id}`}
                className="max-w-full object-contain"
                style={{ maxHeight: "var(--operator-details-preview-max-height)" }}
              />
            ) : (
              <TshirtIcon className="h-24 w-24" style={{ color: "var(--operator-text-muted)" }} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div
            style={{
              padding: "var(--operator-details-card-padding)",
              borderRadius: "var(--operator-details-card-radius)",
              backgroundColor: "var(--operator-card-bg)",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            <h3
              className="mb-1.5 font-bold uppercase tracking-wide"
              style={{ fontSize: "var(--operator-details-card-heading-size)", color: "var(--operator-text-muted)" }}
            >
              Детали заказа
            </h3>
            <DetailRow label="Изделие" value={`${GARMENT_TYPE_LABELS[order.garment.type]}, ${garmentColorLabel(order.garment.color)}`} />
            <DetailRow label="Размер" value={order.garment.size} />
            <DetailRow label="Сторона печати" value={GARMENT_SIDE_LABELS[order.side]} />
            <DetailRow label="Дизайнов" value="1" />
            <DetailRow label="Материал" value={FABRIC_LABELS[order.garment.fabric] ?? order.garment.fabric} />
            <DetailRow label="Цена" value={formatPrice(order.price)} />
            <DetailRow label="Клиент" value="—" />
            <DetailRow label="Способ оплаты" value="—" />
          </div>

          <div
            style={{
              padding: "var(--operator-details-card-padding)",
              borderRadius: "var(--operator-details-card-radius)",
              backgroundColor: "var(--operator-card-bg)",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <h3
                className="font-bold uppercase tracking-wide"
                style={{ fontSize: "var(--operator-details-card-heading-size)", color: "var(--operator-text-muted)" }}
              >
                Дизайн
              </h3>
              {order.designImageUrl && (
                <a
                  href={order.designImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ fontSize: "var(--operator-details-card-heading-size)", color: "var(--operator-accent)" }}
                >
                  Открыть в редакторе
                </a>
              )}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="flex flex-shrink-0 items-center justify-center overflow-hidden"
                style={{
                  width: "var(--operator-details-design-thumb-size)",
                  height: "var(--operator-details-design-thumb-size)",
                  borderRadius: "var(--operator-details-design-thumb-radius)",
                  backgroundColor: "var(--operator-page-bg)",
                  border: "1px solid var(--operator-card-border)",
                }}
              >
                {order.designImageUrl ? (
                  <img src={order.designImageUrl} alt="Дизайн" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs" style={{ color: "var(--operator-text-muted)" }}>
                    нет файла
                  </span>
                )}
              </div>
              <span style={{ fontSize: "var(--operator-details-meta-size)", color: "var(--operator-text-muted)" }}>
                Размер печати соответствует области дизайна на макете
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-shrink-0 flex-col gap-3 pt-5">
        {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
        <div className="flex flex-row" style={{ gap: "var(--operator-details-buttons-gap)" }}>
          {(isNew || isFinal) && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void applyStatus("accepted")}
              className="flex-1 font-extrabold uppercase tracking-wide text-white transition-opacity disabled:opacity-50"
              style={{
                fontSize: "var(--operator-details-button-font-size)",
                paddingBlock: "var(--operator-details-button-padding-y)",
                borderRadius: "var(--operator-details-button-radius)",
                backgroundColor: "var(--operator-details-accept-bg)",
              }}
            >
              {isFinal ? "Повторить печать" : "Отправить на печать"}
            </button>
          )}
          {isInProgress && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void applyStatus("done")}
              className="flex-1 font-extrabold uppercase tracking-wide text-white transition-opacity disabled:opacity-50"
              style={{
                fontSize: "var(--operator-details-button-font-size)",
                paddingBlock: "var(--operator-details-button-padding-y)",
                borderRadius: "var(--operator-details-button-radius)",
                backgroundColor: "var(--operator-details-done-bg)",
              }}
            >
              Готово
            </button>
          )}
          {!isFinal && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void applyStatus("cancelled")}
              className="flex-1 font-extrabold uppercase tracking-wide transition-opacity disabled:opacity-50"
              style={{
                fontSize: "var(--operator-details-button-font-size)",
                paddingBlock: "var(--operator-details-button-padding-y)",
                borderRadius: "var(--operator-details-button-radius)",
                backgroundColor: "var(--operator-card-bg)",
                border: "1px solid var(--operator-card-border)",
                color: "var(--operator-details-cancel-color)",
              }}
            >
              Отменить заказ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
