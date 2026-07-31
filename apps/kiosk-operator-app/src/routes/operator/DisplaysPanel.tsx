import { useCallback, useEffect, useState } from "react";
import { Monitor, SpinnerIcon } from "../../components/icons.js";
import {
  applyDisplayAssignment,
  listDisplays,
  loadDisplayAssignment,
  saveDisplayAssignment,
  type DisplayAssignment,
  type DisplayInfo,
} from "../../lib/displays.js";
import { isPointDesktop } from "../../lib/pointDesktop.js";
import { setReleaseMode } from "../../lib/releaseMode.js";

const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };

function formatSize(display: DisplayInfo): string {
  return `${display.width}×${display.height}${display.isPortrait ? " · вертикальный" : " · горизонтальный"}`;
}

function ScreenCard({
  title,
  hint,
  displays,
  selectedId,
  onSelect,
  preferPortrait,
}: {
  title: string;
  hint: string;
  displays: DisplayInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  preferPortrait?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl p-5" style={CARD_STYLE}>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm" style={LABEL_STYLE}>
          {hint}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {displays.map((display) => {
          const active = display.id === selectedId;
          const recommended = preferPortrait && display.isPortrait;
          return (
            <button
              key={display.id}
              type="button"
              onClick={() => onSelect(display.id)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
              style={{
                backgroundColor: active ? "var(--operator-accent-soft)" : "var(--operator-page-bg)",
                border: `1px solid ${active ? "var(--operator-accent)" : "var(--operator-card-border)"}`,
              }}
            >
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: active ? "var(--operator-accent)" : "var(--operator-card-bg)",
                  color: active ? "#fff" : "var(--operator-text-muted)",
                }}
              >
                <Monitor className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">
                  {display.label}
                  {display.isCurrent ? " · этот" : ""}
                  {recommended ? " · рекомендуем" : ""}
                </span>
                <span className="block text-sm" style={LABEL_STYLE}>
                  {formatSize(display)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function desktopToDisplayInfo(
  rows: Awaited<NonNullable<Window["pointDesktop"]>["listDisplays"] extends () => Promise<infer R> ? R : never>,
): DisplayInfo[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.isPrimary ? `${row.label} (основной)` : row.label,
    left: row.x,
    top: row.y,
    width: row.width,
    height: row.height,
    availLeft: row.x,
    availTop: row.y,
    availWidth: row.width,
    availHeight: row.height,
    isPrimary: row.isPrimary,
    isCurrent: false,
    isPortrait: row.isPortrait,
  }));
}

/**
 * Operator «Экраны» — assign physical monitors to the kiosk (vertical,
 * frameless) and operator (fullscreen) windows in release mode.
 */
export function DisplaysPanel() {
  const desktop = isPointDesktop();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<DisplayAssignment>(loadDisplayAssignment);
  const [applying, setApplying] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (desktop && window.pointDesktop) {
        const rows = await window.pointDesktop.listDisplays();
        const mapped = desktopToDisplayInfo(rows);
        setDisplays(mapped);
        setAdvanced(true);
        const saved = await window.pointDesktop.getAssignment();
        setAssignment((prev) => {
          const portrait = mapped.find((d) => d.isPortrait);
          const primary = mapped.find((d) => d.isPrimary) ?? mapped[0];
          const other = mapped.find((d) => d.id !== (portrait?.id ?? primary?.id)) ?? primary;
          return {
            kioskScreenId:
              saved.kioskIndex != null && mapped[saved.kioskIndex]
                ? mapped[saved.kioskIndex]!.id
                : prev.kioskScreenId && mapped.some((d) => d.id === prev.kioskScreenId)
                  ? prev.kioskScreenId
                  : (portrait?.id ?? other?.id ?? null),
            operatorScreenId:
              saved.operatorIndex != null && mapped[saved.operatorIndex]
                ? mapped[saved.operatorIndex]!.id
                : prev.operatorScreenId && mapped.some((d) => d.id === prev.operatorScreenId)
                  ? prev.operatorScreenId
                  : (primary?.id ?? mapped[0]?.id ?? null),
          };
        });
        return;
      }

      const result = await listDisplays();
      setDisplays(result.displays);
      setAdvanced(result.advanced);
      setAssignment((prev) => {
        const ids = new Set(result.displays.map((d) => d.id));
        const portrait = result.displays.find((d) => d.isPortrait);
        const primary = result.displays.find((d) => d.isPrimary) ?? result.displays[0];
        const other =
          result.displays.find((d) => d.id !== (portrait?.id ?? primary?.id)) ?? primary;
        return {
          kioskScreenId:
            prev.kioskScreenId && ids.has(prev.kioskScreenId)
              ? prev.kioskScreenId
              : (portrait?.id ?? other?.id ?? null),
          operatorScreenId:
            prev.operatorScreenId && ids.has(prev.operatorScreenId)
              ? prev.operatorScreenId
              : (primary?.id ?? result.displays[0]?.id ?? null),
        };
      });
    } finally {
      setLoading(false);
    }
  }, [desktop]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function updateAssignment(patch: Partial<DisplayAssignment>) {
    setAssignment((prev) => {
      const next = { ...prev, ...patch };
      saveDisplayAssignment(next);
      return next;
    });
  }

  async function handleApply() {
    setApplying(true);
    setNote(null);
    try {
      setReleaseMode(true);
      if (desktop && window.pointDesktop) {
        const kioskIndex = displays.findIndex((d) => d.id === assignment.kioskScreenId);
        const operatorIndex = displays.findIndex((d) => d.id === assignment.operatorScreenId);
        if (kioskIndex < 0 || operatorIndex < 0) throw new Error("monitor");
        await window.pointDesktop.applyDisplays({ kioskIndex, operatorIndex });
        saveDisplayAssignment(assignment);
        setNote("Применено — окна на выбранных мониторах");
      } else {
        await applyDisplayAssignment(assignment);
        setNote("Применено — окна на выбранных мониторах");
      }
    } catch {
      setNote(
        desktop
          ? "Не удалось применить мониторы"
          : "Не удалось применить. Разрешите доступ к экранам в Chrome.",
      );
    } finally {
      setApplying(false);
      setTimeout(() => setNote(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm" style={LABEL_STYLE}>
        <SpinnerIcon className="h-5 w-5 animate-spin" />
        Загрузка мониторов…
      </div>
    );
  }

  return (
    <div className="app-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--operator-accent-soft)", color: "var(--operator-accent)" }}
          >
            <Monitor className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white">Экраны</h2>
            <p className="text-sm" style={LABEL_STYLE}>
              {desktop
                ? "Приложение Windows: безрамочные окна киоска и оператора на выбранных мониторах"
                : "Релиз: киоск и оператор — безрамочно на весь экран"}
            </p>
          </div>
        </div>
        {note && (
          <span
            className="text-sm font-semibold"
            style={{
              color:
                note.startsWith("Применено") || note.startsWith("Релиз-режим выключен")
                  ? "#3ecf5f"
                  : "#f14668",
            }}
          >
            {note}
          </span>
        )}
      </div>

      {!advanced && !desktop && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ ...CARD_STYLE, color: "var(--operator-text-muted)" }}>
          Chrome не отдал список мониторов. Нажмите «Применить» и разрешите доступ к экранам — после
          этого можно выбрать монитор для киоска и оператора.
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row">
        <ScreenCard
          title="Киоск"
          hint="Вертикальный клиентский экран без рамок"
          displays={displays}
          selectedId={assignment.kioskScreenId}
          onSelect={(id) => updateAssignment({ kioskScreenId: id })}
          preferPortrait
        />
        <ScreenCard
          title="Оператор"
          hint="Панель заказов на весь выбранный монитор"
          displays={displays}
          selectedId={assignment.operatorScreenId}
          onSelect={(id) => updateAssignment({ operatorScreenId: id })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={applying || !assignment.kioskScreenId || !assignment.operatorScreenId}
          onClick={() => void handleApply()}
          className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--operator-accent)" }}
        >
          {applying ? "Применение…" : "Применить и открыть во весь экран"}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl px-5 py-3 text-sm font-semibold"
          style={{ ...CARD_STYLE, color: "var(--operator-text-muted)" }}
        >
          Обновить список
        </button>
        {!desktop && (
          <button
            type="button"
            onClick={() => {
              setReleaseMode(false);
              if (document.fullscreenElement) void document.exitFullscreen();
              setNote("Релиз-режим выключен для этого браузера");
              setTimeout(() => setNote(null), 3000);
            }}
            className="rounded-xl px-5 py-3 text-sm font-semibold"
            style={{ ...CARD_STYLE, color: "var(--operator-text-muted)" }}
          >
            Выйти из релиз-режима
          </button>
        )}
      </div>
    </div>
  );
}
