import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Clock,
  FilmIcon,
  Headset,
  History,
  Layers,
  ListOrdered,
  Bell,
  Monitor,
  Palette,
  Printer,
  Settings,
  Sparkles,
  Users,
} from "../../components/icons.js";
import { OperatorOnlineStatus } from "./OperatorOnlineStatus.js";

export type OperatorView =
  | "orders"
  | "inProgress"
  | "history"
  | "designs"
  | "aiStyles"
  | "ads"
  | "printSettings"
  | "displays"
  | "materials";

interface NavItem {
  id: OperatorView | "clients" | "printer" | "schedule" | "notifications" | "support";
  label: string;
  icon: LucideIcon | typeof FilmIcon;
  view?: OperatorView;
}

const NAV_ITEMS: NavItem[] = [
  { id: "orders", label: "Заказы", icon: ListOrdered, view: "orders" },
  { id: "inProgress", label: "В работе", icon: Clock, view: "inProgress" },
  { id: "history", label: "История", icon: History, view: "history" },
  { id: "designs", label: "Дизайны", icon: Palette, view: "designs" },
  { id: "aiStyles", label: "ИИ-стили", icon: Sparkles, view: "aiStyles" },
  { id: "ads", label: "Реклама", icon: FilmIcon, view: "ads" },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "printer", label: "Принтер", icon: Printer },
  { id: "printSettings", label: "Настройки печати", icon: Settings, view: "printSettings" },
  { id: "displays", label: "Экраны", icon: Monitor, view: "displays" },
  { id: "materials", label: "Материалы", icon: Layers, view: "materials" },
  { id: "schedule", label: "Расписание", icon: Calendar },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "support", label: "Поддержка", icon: Headset },
];

/**
 * Sidebar navigation from `docs/ui-mockups/operator.png`. Only the items
 * with a `view` are wired to real content (Stage 5 scope) — the rest render
 * for visual fidelity but are inert (see Stage 5 plan's scope decision).
 * Every size/spacing/color below is a `--operator-sidebar-*` CSS token, live
 * tunable via `OperatorThemePanel`.
 */
export function OperatorSidebar({ view, onChangeView }: { view: OperatorView; onChangeView: (view: OperatorView) => void }) {
  return (
    <aside
      className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-r"
      style={{
        width: "var(--operator-sidebar-width)",
        backgroundColor: "var(--operator-sidebar-bg)",
        borderColor: "var(--operator-card-border)",
      }}
    >
      <div
        className="flex flex-col"
        style={{
          gap: "var(--operator-sidebar-header-gap)",
          padding: "var(--operator-sidebar-header-padding-y) var(--operator-sidebar-header-padding-x)",
        }}
      >
        <span
          className="font-extrabold tracking-wide"
          style={{ fontSize: "var(--operator-sidebar-logo-size)", color: "var(--operator-sidebar-logo-color)" }}
        >
          T-SHIRT PRINT
        </span>
        <span
          className="font-bold uppercase tracking-[0.2em]"
          style={{ fontSize: "var(--operator-sidebar-subtitle-size)", color: "var(--operator-sidebar-subtitle-color)" }}
        >
          Оператор
        </span>
      </div>

      <nav
        className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ gap: "var(--operator-sidebar-nav-item-gap)", paddingInline: "var(--operator-sidebar-nav-padding-x)" }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.view === view;
          const isInteractive = item.view !== undefined;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!isInteractive}
              onClick={() => item.view && onChangeView(item.view)}
              className={`flex items-center text-left font-semibold transition-colors ${
                isInteractive ? "cursor-pointer" : "cursor-default opacity-40"
              }`}
              style={{
                gap: "var(--operator-sidebar-nav-icon-gap)",
                padding: "var(--operator-sidebar-nav-item-padding-y) var(--operator-sidebar-nav-item-padding-x)",
                borderRadius: "var(--operator-sidebar-nav-item-radius)",
                fontSize: "var(--operator-sidebar-nav-font-size)",
                backgroundColor: isActive ? "var(--operator-sidebar-nav-active-bg)" : "transparent",
                color: isActive ? "var(--operator-sidebar-nav-active-color)" : "var(--operator-sidebar-nav-idle-color)",
              }}
            >
              <Icon
                className="flex-shrink-0"
                style={{ width: "var(--operator-sidebar-nav-icon-size)", height: "var(--operator-sidebar-nav-icon-size)" }}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div
        className="flex items-center border-t"
        style={{
          gap: "var(--operator-sidebar-footer-gap)",
          padding: "var(--operator-sidebar-footer-padding-y) var(--operator-sidebar-footer-padding-x)",
          borderColor: "var(--operator-card-border)",
        }}
      >
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
          style={{
            width: "var(--operator-sidebar-avatar-size)",
            height: "var(--operator-sidebar-avatar-size)",
            fontSize: "var(--operator-sidebar-avatar-font-size)",
            backgroundColor: "var(--operator-sidebar-avatar-bg)",
            color: "var(--operator-sidebar-avatar-color)",
          }}
        >
          О
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-white" style={{ fontSize: "var(--operator-sidebar-name-size)" }}>
            Оператор
          </span>
          <span style={{ fontSize: "var(--operator-sidebar-role-size)", color: "var(--operator-text-muted)" }}>
            Администратор
          </span>
        </div>
        <div className="ml-auto">
          <OperatorOnlineStatus />
        </div>
      </div>
    </aside>
  );
}
