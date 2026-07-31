import { useEffect, useMemo, useState } from "react";
import type { Order } from "@tshirt/shared-types";
import { fetchOrders, subscribeOrderEvents } from "../../lib/pointServer.js";
import { syncAllOperatorScrollElements } from "../../lib/operatorScrollTheme.js";
import { OPERATOR_HEIGHT } from "../../components/OperatorFrame.js";
import { OperatorSidebar, type OperatorView } from "./OperatorSidebar.js";
import { OrderStatsBar } from "./OrderStatsBar.js";
import { OrderList } from "./OrderList.js";
import { OrderDetails } from "./OrderDetails.js";
import { PrinterPanel } from "./PrinterPanel.js";
import { DesignsPanel } from "./DesignsPanel.js";
import { AiStylesPanel } from "./AiStylesPanel.js";
import { AdsVideosPanel } from "./AdsVideosPanel.js";
import { PrintAreaSettingsPanel } from "./PrintAreaSettingsPanel.js";
import { DisplaysPanel } from "./DisplaysPanel.js";

/**
 * `/operator` — realtime order feed for the printing point, strictly
 * matching `docs/ui-mockups/operator.png` (see `docs/PLAN.md` Этап 5).
 * Rendered at a fixed `OPERATOR_HEIGHT` reference canvas whose width is
 * dynamic (see `OperatorFrame`, which takes care of uniformly scaling it to
 * the real monitor without ever distorting proportions).
 */
export function OperatorHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<OperatorView>("orders");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOrders()
      .then((rows) => {
        if (cancelled) return;
        setOrders(rows);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      subscribeOrderEvents((event) => {
        setOrders((prev) => {
          if (event.type === "created") {
            return prev.some((o) => o.id === event.order.id) ? prev : [event.order, ...prev];
          }
          return prev.map((o) => (o.id === event.order.id ? event.order : o));
        });
      }),
    [],
  );

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [orders],
  );

  const ordersInView = useMemo(() => {
    if (view === "inProgress") {
      return sortedOrders.filter((order) => order.status === "accepted" || order.status === "printing");
    }
    if (view === "history") {
      return sortedOrders.filter((order) => order.status === "done" || order.status === "cancelled");
    }
    return sortedOrders;
  }, [sortedOrders, view]);

  const filteredOrders = useMemo(() => {
    const query = search.trim();
    if (!query) return ordersInView;
    return ordersInView.filter((order) => order.id.includes(query));
  }, [ordersInView, search]);

  useEffect(() => {
    if (selectedId && filteredOrders.some((order) => order.id === selectedId)) return;
    setSelectedId(filteredOrders[0]?.id ?? null);
  }, [filteredOrders, selectedId]);

  useEffect(() => {
    const root = document.querySelector(".operator-theme-root");
    if (!(root instanceof HTMLElement)) return;
    const frame = requestAnimationFrame(() => syncAllOperatorScrollElements(root));
    return () => cancelAnimationFrame(frame);
  }, [view, loaded, filteredOrders.length]);

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      new: orders.filter((order) => order.status === "new").length,
      inProgress: orders.filter((order) => order.status === "accepted" || order.status === "printing").length,
      done: orders.filter((order) => order.status === "done").length,
      total: orders.filter((order) => order.status !== "cancelled").length,
    }),
    [orders],
  );

  function handleOrderUpdated(updated: Order) {
    setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
  }

  return (
    <div
      className="operator-theme-root flex w-full overflow-hidden text-white"
      style={{ height: OPERATOR_HEIGHT, backgroundColor: "var(--operator-page-bg)" }}
    >
      <OperatorSidebar view={view} onChangeView={setView} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <OrderStatsBar counts={counts} />

        {view === "designs" ? (
          <DesignsPanel />
        ) : view === "aiStyles" ? (
          <AiStylesPanel />
        ) : view === "ads" ? (
          <AdsVideosPanel />
        ) : view === "printSettings" ? (
          <PrintAreaSettingsPanel />
        ) : view === "displays" ? (
          <DisplaysPanel />
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <OrderList
              orders={filteredOrders}
              totalInView={ordersInView.length}
              selectedId={selectedId}
              onSelect={setSelectedId}
              search={search}
              onSearchChange={setSearch}
              loaded={loaded}
            />
            <OrderDetails order={selectedOrder} onUpdated={handleOrderUpdated} />
            <PrinterPanel doneToday={counts.done} />
          </div>
        )}
      </div>
    </div>
  );
}
