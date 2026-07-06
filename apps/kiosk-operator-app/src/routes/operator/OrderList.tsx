import type { Order } from "@tshirt/shared-types";
import { OrderListItem } from "./OrderListItem.js";

export function OrderList({
  orders,
  totalInView,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  loaded,
}: {
  orders: Order[];
  totalInView: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loaded: boolean;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-r"
      style={{ width: "var(--operator-list-width)", borderColor: "var(--operator-card-border)" }}
    >
      <div
        className="flex flex-shrink-0 flex-col gap-2.5"
        style={{
          paddingInline: "var(--operator-list-header-padding-x)",
          paddingTop: "var(--operator-list-header-padding-top)",
          paddingBottom: "var(--operator-list-header-padding-bottom)",
        }}
      >
        <span
          className="font-bold uppercase tracking-wide"
          style={{ fontSize: "var(--operator-list-title-size)", color: "var(--operator-text-muted)" }}
        >
          Список заказов
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Поиск по номеру заказа"
          className="w-full px-4 text-white outline-none placeholder:text-[color:var(--operator-text-muted)]"
          style={{
            height: "var(--operator-list-search-height)",
            fontSize: "var(--operator-list-search-font-size)",
            borderRadius: "var(--operator-list-search-radius)",
            backgroundColor: "var(--operator-card-bg)",
            border: "1px solid var(--operator-card-border)",
          }}
        />
      </div>

      <div
        className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pb-3"
        style={{ gap: "var(--operator-list-item-gap)", paddingInline: "var(--operator-list-items-padding-x)" }}
      >
        {!loaded && (
          <p className="px-2 py-4" style={{ fontSize: "var(--operator-list-search-font-size)", color: "var(--operator-text-muted)" }}>
            Загрузка заказов…
          </p>
        )}
        {loaded && orders.length === 0 && (
          <p className="px-2 py-4" style={{ fontSize: "var(--operator-list-search-font-size)", color: "var(--operator-text-muted)" }}>
            Заказов не найдено
          </p>
        )}
        {orders.map((order) => (
          <OrderListItem key={order.id} order={order} isSelected={order.id === selectedId} onSelect={() => onSelect(order.id)} />
        ))}
      </div>

      <div
        className="flex-shrink-0 border-t"
        style={{
          fontSize: "var(--operator-list-footer-font-size)",
          padding: "var(--operator-list-footer-padding-y) var(--operator-list-footer-padding-x)",
          borderColor: "var(--operator-card-border)",
          color: "var(--operator-text-muted)",
        }}
      >
        Показано {orders.length} из {totalInView}
      </div>
    </div>
  );
}
