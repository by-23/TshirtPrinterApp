import { useState } from "react";
import { garmentHasSelectableBackSide, getOrderPrintSides, type GarmentSide, type Order } from "@tshirt/shared-types";
import { updateOrderStatus } from "../../lib/pointServer.js";
import { describeDtfPrintJobs, sendOrderToDtfPrint } from "../../lib/printOrder.js";
import { GarmentMockup } from "../../editor/mockup/index.js";
import { StatusBadge } from "./StatusBadge.js";
import { OrderImage } from "./OrderImage.js";
import { displayOrderNumber } from "../../lib/orderNumber.js";
import {
  GARMENT_SIDE_LABELS,
  formatOrderDate,
  formatOrderSides,
  formatOrderTime,
  formatPrice,
  garmentColorLabel,
  garmentFabricLabel,
  garmentSizeLabel,
  garmentTypeLabel,
} from "./orderLabels.js";
import { useGarmentCatalogStore } from "../../lib/garmentCatalogStore.js";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ fontSize: "var(--operator-details-row-font-size)" }}>
      <span style={{ color: "var(--operator-text-muted)" }}>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export function OrderDetails({ order: orderProp, onUpdated }: { order: Order | null; onUpdated: (order: Order) => void }) {
  const catalog = useGarmentCatalogStore((state) => state.catalog);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printHint, setPrintHint] = useState<string | null>(null);
  const [previewByOrderId, setPreviewByOrderId] = useState<Partial<Record<string, GarmentSide>>>({});

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
  const printSides = getOrderPrintSides(order);
  const previewSide = previewByOrderId[order.id] ?? order.side;
  const activePrint = printSides.find((item) => item.side === previewSide) ?? null;
  const sideLabels = formatOrderSides(printSides.map((item) => item.side));
  const canSelectBack = garmentHasSelectableBackSide(order.garment.type);

  const isNew = order.status === "new";
  const isInProgress = order.status === "accepted" || order.status === "printing";
  const isFinal = order.status === "done" || order.status === "cancelled";

  async function applyStatus(status: "accepted" | "done" | "cancelled") {
    const ticket = displayOrderNumber(order.id);
    if (status === "cancelled" && !window.confirm(`Отменить заказ №${ticket}?`)) return;
    if (status === "accepted" && isFinal) {
      const message =
        order.status === "cancelled"
          ? `Заказ №${ticket} отменён. Отправить на печать повторно?`
          : `Заказ №${ticket} уже выполнен. Отправить на печать повторно?`;
      if (!window.confirm(message)) return;
    }
    setError(null);
    setPrintHint(null);
    setIsUpdating(true);
    try {
      if (status === "accepted") {
        if (!printSides.some((item) => item.designImageUrl)) {
          throw new Error("no design");
        }
        // Prepare RIP-ready DTF PNG (mm @ 300 DPI, mirror) → hotfolder + Explorer.
        const prepared = await sendOrderToDtfPrint(order.id);
        setPrintHint(describeDtfPrintJobs(prepared.printJobs ?? [prepared.printJob]));
        onUpdated(prepared.order);
      }
      const updated = await updateOrderStatus(order.id, status);
      onUpdated(updated);
    } catch {
      setError(
        status === "accepted"
          ? "Не удалось подготовить файл для DTF. Проверьте дизайн и настройки принтера."
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
            Заказ №{displayOrderNumber(order.id)}
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
            {(["front", "back"] as const).map((side) => {
              const selectable = side === "front" || canSelectBack;
              const active = previewSide === side;
              return (
                <button
                  key={side}
                  type="button"
                  disabled={!selectable}
                  onClick={() => setPreviewByOrderId((current) => ({ ...current, [order.id]: side }))}
                  className="rounded-full font-bold uppercase tracking-wide disabled:cursor-default"
                  style={{
                    fontSize: "var(--operator-details-side-font-size)",
                    padding: "var(--operator-details-side-padding-y) var(--operator-details-side-padding-x)",
                    backgroundColor: active ? "var(--operator-accent)" : "var(--operator-card-bg)",
                    color: active ? "#fff" : "var(--operator-text-muted)",
                    border: "1px solid var(--operator-card-border)",
                    opacity: selectable ? 1 : 0.45,
                  }}
                >
                  {GARMENT_SIDE_LABELS[side]}
                </button>
              );
            })}
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
            {activePrint?.mockupImageUrl ? (
              <OrderImage
                src={activePrint.mockupImageUrl}
                alt={`Мокап заказа №${displayOrderNumber(order.id)}`}
                className="max-w-full object-contain"
                style={{ maxHeight: "var(--operator-details-preview-max-height)" }}
                iconClassName="h-24 w-24"
                iconStyle={{ color: "var(--operator-text-muted)" }}
              />
            ) : (
              <div
                className="flex w-full items-center justify-center"
                style={{ maxHeight: "var(--operator-details-preview-max-height)", height: "var(--operator-details-preview-max-height)" }}
              >
                <GarmentMockup
                  garmentType={order.garment.type}
                  side={previewSide}
                  color={order.garment.color}
                  className="h-full w-full"
                />
              </div>
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
            <DetailRow label="Изделие" value={`${garmentTypeLabel(order.garment.type, catalog)}, ${garmentColorLabel(order.garment.color, catalog)}`} />
            <DetailRow label="Размер" value={garmentSizeLabel(order.garment.size, catalog)} />
            <DetailRow label="Сторона печати" value={sideLabels} />
            <DetailRow label="Дизайнов" value={String(printSides.length)} />
            <DetailRow label="Материал" value={garmentFabricLabel(order.garment.fabric, catalog)} />
            <DetailRow label="Цена" value={formatPrice(order.price)} />
            <DetailRow label="Печатей" value={String(order.printCount)} />
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
              {activePrint?.designImageUrl && (
                <a
                  href={activePrint.designImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ fontSize: "var(--operator-details-card-heading-size)", color: "var(--operator-accent)" }}
                >
                  Открыть в редакторе
                </a>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {printSides.map((item) => (
                <button
                  key={item.side}
                  type="button"
                  onClick={() => setPreviewByOrderId((current) => ({ ...current, [order.id]: item.side }))}
                  className="flex items-center gap-4 text-left"
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-center overflow-hidden"
                    style={{
                      width: "var(--operator-details-design-thumb-size)",
                      height: "var(--operator-details-design-thumb-size)",
                      borderRadius: "var(--operator-details-design-thumb-radius)",
                      backgroundColor: "var(--operator-page-bg)",
                      border: `1px solid ${item.side === previewSide ? "var(--operator-accent)" : "var(--operator-card-border)"}`,
                    }}
                  >
                    {item.designImageUrl ? (
                      <OrderImage
                        src={item.designImageUrl}
                        alt={GARMENT_SIDE_LABELS[item.side]}
                        className="h-full w-full object-contain"
                        iconClassName="h-8 w-8"
                        iconStyle={{ color: "var(--operator-text-muted)" }}
                      />
                    ) : (
                      <span className="text-xs" style={{ color: "var(--operator-text-muted)" }}>
                        нет файла
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "var(--operator-details-meta-size)", color: "var(--operator-text-muted)" }}>
                    {GARMENT_SIDE_LABELS[item.side]}
                    {printSides.length === 1
                      ? " — для Epson L1800 (DTF) готовится PNG 300 DPI под RIP (AcroRIP)"
                      : ""}
                  </span>
                </button>
              ))}
              {printSides.length > 1 && (
                <span style={{ fontSize: "var(--operator-details-meta-size)", color: "var(--operator-text-muted)" }}>
                  Для Epson L1800 (DTF) готовится PNG 300 DPI под RIP (AcroRIP) на каждую сторону
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-shrink-0 flex-col gap-3 pt-5">
        {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
        {printHint && (
          <p
            className="whitespace-pre-line text-sm font-semibold"
            style={{ color: "var(--operator-printer-ready-color, #4ade80)" }}
          >
            {printHint}
          </p>
        )}
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
