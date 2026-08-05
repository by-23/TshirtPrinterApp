import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DEFAULT_DTF_PRINTER_CONFIG,
  type DtfInkLevels,
  type DtfPrinterConfig,
  type GarmentType,
  type PrintSizeMm,
} from "@tshirt/shared-types";
import { CircleCheck, Droplet, Printer } from "../../components/icons.js";
import { OperatorSelect } from "../../components/OperatorSelect.js";
import {
  fetchPrinterStatus,
  openPrinterHotfolder,
  openPrinterQueue,
  runPrinterNozzleCheck,
  updateDtfPrinterConfig,
  type PrinterStatusResponse,
  type WindowsPrinterHealth,
} from "../../lib/pointServer.js";

const MEDIA_SIZES = ["A3+", "A3"] as const;
const DPI_OPTIONS = ["300", "240", "360"] as const;

const INK_META: Array<{ key: keyof DtfInkLevels; label: string; hex: string }> = [
  { key: "C", label: "C", hex: "#22d3f5" },
  { key: "M", label: "M", hex: "#ec4899" },
  { key: "Y", label: "Y", hex: "#eab308" },
  { key: "K", label: "K", hex: "#e5e5e5" },
  { key: "Lc", label: "Lc", hex: "#7dd3fc" },
  { key: "Lm", label: "Lm", hex: "#f9a8d4" },
];

const INK_STEPS = [100, 75, 50, 25, 10, 0] as const;

const GARMENT_LABELS: Record<GarmentType, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};

const sectionStyle: CSSProperties = {
  padding: "var(--operator-printer-section-padding)",
  borderRadius: "var(--operator-printer-section-radius)",
  backgroundColor: "var(--operator-card-bg)",
  border: "1px solid var(--operator-card-border)",
};

function cloneConfig(config: DtfPrinterConfig): DtfPrinterConfig {
  return JSON.parse(JSON.stringify(config)) as DtfPrinterConfig;
}

function healthColor(health: WindowsPrinterHealth): string {
  if (health === "ready" || health === "busy") return "var(--operator-printer-ready-color)";
  if (health === "offline" || health === "error" || health === "not_found") return "#f87171";
  return "var(--operator-text-muted)";
}

function healthLabel(health: WindowsPrinterHealth, statusText: string): string {
  if (health === "ready") return "Готов";
  if (health === "busy") return statusText || "Занят";
  if (health === "offline") return "Офлайн";
  if (health === "error") return statusText || "Ошибка";
  if (health === "not_found") return "Не найден";
  return statusText || "Нет данных";
}

function SizeFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PrintSizeMm;
  onChange: (next: PrintSizeMm) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={20}
          max={500}
          value={value.widthMm}
          onChange={(e) => onChange({ ...value, widthMm: Number(e.target.value) || value.widthMm })}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 font-semibold text-white outline-none"
          style={{
            fontSize: "var(--operator-printer-row-font-size)",
            border: "1px solid var(--operator-card-border)",
          }}
          aria-label={`${label} ширина мм`}
        />
        <span style={{ color: "var(--operator-text-muted)" }}>×</span>
        <input
          type="number"
          min={20}
          max={600}
          value={value.heightMm}
          onChange={(e) => onChange({ ...value, heightMm: Number(e.target.value) || value.heightMm })}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 font-semibold text-white outline-none"
          style={{
            fontSize: "var(--operator-printer-row-font-size)",
            border: "1px solid var(--operator-card-border)",
          }}
          aria-label={`${label} высота мм`}
        />
        <span style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
          мм
        </span>
      </div>
    </div>
  );
}

/**
 * Live Epson L1800 / DTF panel: Windows status, manual tank levels, print-folder
 * actions, and persisted RIP file settings.
 */
export function PrinterPanel({ doneToday }: { doneToday: number }) {
  const [config, setConfig] = useState<DtfPrinterConfig>(() => cloneConfig(DEFAULT_DTF_PRINTER_CONFIG));
  const [status, setStatus] = useState<PrinterStatusResponse | null>(null);
  const [sizeGarment, setSizeGarment] = useState<GarmentType>("tshirt");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const configRef = useRef(config);
  const dirtyRef = useRef(false);
  configRef.current = config;
  dirtyRef.current = dirty;

  const refreshStatus = useCallback(async (opts?: { keepConfig?: boolean }) => {
    const res = await fetchPrinterStatus();
    setStatus(res);
    if (!opts?.keepConfig) {
      setConfig(cloneConfig(res.config));
      setDirty(false);
    }
    setLoaded(true);
    return res;
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshStatus()
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
          setError("Не удалось связаться с point-server для статуса принтера.");
        }
      });
    const timer = window.setInterval(() => {
      void refreshStatus({ keepConfig: dirtyRef.current }).catch(() => undefined);
    }, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [refreshStatus]);

  const persist = useCallback(async (next: DtfPrinterConfig) => {
    setSaving(true);
    setError(null);
    try {
      await updateDtfPrinterConfig({ config: next });
      setDirty(false);
      setMessage("Сохранено");
      await refreshStatus({ keepConfig: true });
    } catch {
      setError("Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }, [refreshStatus]);

  function scheduleSave(next: DtfPrinterConfig) {
    setDirty(true);
    setMessage(null);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist(next);
    }, 600);
  }

  function patchConfig(patch: Partial<DtfPrinterConfig>) {
    const next = { ...configRef.current, ...patch };
    setConfig(next);
    scheduleSave(next);
  }

  function patchPrintSize(side: "front" | "back", nextSize: PrintSizeMm) {
    const next: DtfPrinterConfig = {
      ...configRef.current,
      printSizeMm: {
        ...configRef.current.printSizeMm,
        [sizeGarment]: {
          ...configRef.current.printSizeMm[sizeGarment],
          [side]: nextSize,
        },
      },
    };
    setConfig(next);
    scheduleSave(next);
  }

  function cycleInk(key: keyof DtfInkLevels) {
    const current = configRef.current.inkLevels[key];
    const idx = INK_STEPS.indexOf(current as (typeof INK_STEPS)[number]);
    const nextLevel = INK_STEPS[idx < 0 || idx >= INK_STEPS.length - 1 ? 0 : idx + 1]!;
    patchConfig({
      inkLevels: { ...configRef.current.inkLevels, [key]: nextLevel },
    });
  }

  function reset() {
    const next = cloneConfig(DEFAULT_DTF_PRINTER_CONFIG);
    // Keep the bound Windows queue if we already detected one.
    if (status?.windows.name && status.windows.health !== "not_found") {
      next.windowsPrinterName = status.windows.name;
    }
    setConfig(next);
    scheduleSave(next);
  }

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyAction(id);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch {
      setError("Действие не выполнено. Проверьте принтер и Windows.");
    } finally {
      setBusyAction(null);
      void refreshStatus({ keepConfig: true }).catch(() => undefined);
    }
  }

  const innerGap = "var(--operator-printer-inner-gap)";
  const sideSizes = config.printSizeMm[sizeGarment];
  const windows = status?.windows;
  const health = windows?.health ?? "unknown";
  const printerOptions =
    status?.installedPrinters.length
      ? ["Авто (L1800 / Epson)", ...status.installedPrinters]
      : ["Авто (L1800 / Epson)"];
  const selectedPrinterLabel = config.windowsPrinterName.trim()
    ? config.windowsPrinterName
    : "Авто (L1800 / Epson)";

  return (
    <div
      className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-l"
      style={{
        width: "var(--operator-printer-width)",
        paddingTop: "var(--operator-printer-padding-y)",
        paddingRight: "var(--operator-printer-padding-x)",
        paddingLeft: "var(--operator-printer-padding-x)",
        borderColor: "var(--operator-card-border)",
      }}
    >
      <div
        className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ gap: "var(--operator-printer-section-gap)" }}
      >
        <section className="flex flex-col" style={{ ...sectionStyle, gap: innerGap }}>
          <div className="flex items-center justify-between">
            <h3
              className="font-bold uppercase tracking-wide"
              style={{ fontSize: "var(--operator-printer-heading-size)", color: "var(--operator-text-muted)" }}
            >
              Принтер
            </h3>
            <span
              className="flex items-center gap-1.5 font-bold"
              style={{ fontSize: "var(--operator-printer-status-size)", color: healthColor(health) }}
            >
              <CircleCheck className="h-4 w-4" />
              {healthLabel(health, windows?.statusText ?? "")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex flex-shrink-0 items-center justify-center rounded-xl"
              style={{
                width: "var(--operator-printer-icon-box-size)",
                height: "var(--operator-printer-icon-box-size)",
                backgroundColor: "var(--operator-page-bg)",
              }}
            >
              <Printer
                style={{
                  width: "var(--operator-printer-icon-size)",
                  height: "var(--operator-printer-icon-size)",
                  color: "var(--operator-text-muted)",
                }}
              />
            </div>
            <div className="min-w-0">
              <span className="block font-semibold text-white" style={{ fontSize: "var(--operator-printer-name-size)" }}>
                {windows?.name || config.printerModel}
              </span>
              <span style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
                {windows?.driverName || `Плёнка ${config.mediaSize}`}
                {typeof windows?.jobCount === "number" ? ` · очередь ${windows.jobCount}` : ""}
              </span>
            </div>
          </div>

          <div>
            <p
              className="mb-1 font-semibold"
              style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}
            >
              Чернила (нажмите после долива)
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {INK_META.map((ink) => {
                const level = config.inkLevels[ink.key];
                const low = level <= 25;
                return (
                  <button
                    key={ink.key}
                    type="button"
                    title={`${ink.label}: ${level}% — клик меняет уровень`}
                    onClick={() => cycleInk(ink.key)}
                    className="flex flex-col items-center gap-1 rounded-md transition-opacity hover:opacity-90"
                  >
                    <div
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: "var(--operator-printer-ink-circle-size)",
                        height: "var(--operator-printer-ink-circle-size)",
                        border: `2px solid ${ink.hex}`,
                        opacity: 0.35 + (level / 100) * 0.65,
                        boxShadow: low ? `0 0 0 1px #f87171` : undefined,
                      }}
                    >
                      <Droplet
                        style={{
                          width: "var(--operator-printer-ink-icon-size)",
                          height: "var(--operator-printer-ink-icon-size)",
                          color: ink.hex,
                        }}
                      />
                    </div>
                    <span
                      className="font-bold"
                      style={{
                        fontSize: "var(--operator-printer-ink-value-size)",
                        color: low ? "#f87171" : "#fff",
                      }}
                    >
                      {level}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ fontSize: "var(--operator-printer-row-font-size)" }}>
            <span style={{ color: "var(--operator-text-muted)" }}>Обслуживание</span>
            <span className="font-semibold" style={{ color: healthColor(health) }}>
              {status?.summary ?? "…"}
            </span>
          </div>

          <button
            type="button"
            disabled={!loaded || busyAction !== null || health === "not_found"}
            onClick={() =>
              void runAction("nozzle", async () => {
                const res = await runPrinterNozzleCheck();
                setMessage(res.message);
              })
            }
            className="font-bold uppercase tracking-wide text-white transition-opacity disabled:opacity-50"
            style={{
              fontSize: "var(--operator-printer-button-font-size)",
              paddingBlock: "var(--operator-printer-button-padding-y)",
              borderRadius: "var(--operator-printer-button-radius)",
              backgroundColor: "var(--operator-page-bg)",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            {busyAction === "nozzle" ? "Отправка…" : "Тест дюз"}
          </button>

          <button
            type="button"
            disabled={!loaded || busyAction !== null || health === "not_found"}
            onClick={() =>
              void runAction("queue", async () => {
                const res = await openPrinterQueue();
                setMessage(`Очередь Windows: ${res.printerName}`);
              })
            }
            className="font-bold uppercase tracking-wide text-white transition-opacity disabled:opacity-50"
            style={{
              fontSize: "var(--operator-printer-button-font-size)",
              paddingBlock: "var(--operator-printer-button-padding-y)",
              borderRadius: "var(--operator-printer-button-radius)",
              backgroundColor: "var(--operator-page-bg)",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            {busyAction === "queue" ? "Открытие…" : "Очередь Windows"}
          </button>

          <button
            type="button"
            disabled={!loaded || busyAction !== null}
            onClick={() =>
              void runAction("folder", async () => {
                const res = await openPrinterHotfolder();
                setMessage(
                  `Папка печати открыта (${status?.hotfolder.fileCount ?? 0} файл.). Сюда попадают PNG после «Отправить на печать» — откройте их в AcroRIP.`,
                );
                if (!res.ok) throw new Error("open failed");
              })
            }
            className="font-bold uppercase tracking-wide text-white transition-opacity disabled:opacity-50"
            style={{
              fontSize: "var(--operator-printer-button-font-size)",
              paddingBlock: "var(--operator-printer-button-padding-y)",
              borderRadius: "var(--operator-printer-button-radius)",
              backgroundColor: "var(--operator-accent)",
            }}
          >
            {busyAction === "folder" ? "Открытие…" : "Открыть папку печати"}
          </button>
          <p style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
            «Папка печати» = готовые PNG для AcroRIP (не очередь Windows)
          </p>
        </section>

        <section className="flex flex-col" style={{ ...sectionStyle, gap: innerGap }}>
          <h3
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: "var(--operator-printer-heading-size)", color: "var(--operator-text-muted)" }}
          >
            Настройки DTF
          </h3>

          <label
            className="flex flex-col gap-1"
            style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}
          >
            Принтер Windows
            <OperatorSelect
              value={selectedPrinterLabel}
              onChange={(value) =>
                patchConfig({
                  windowsPrinterName: value === "Авто (L1800 / Epson)" ? "" : value,
                })
              }
              options={printerOptions}
            />
          </label>

          <label
            className="flex flex-col gap-1"
            style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}
          >
            Плёнка
            <OperatorSelect
              value={config.mediaSize}
              onChange={(value) => patchConfig({ mediaSize: value as "A3" | "A3+" })}
              options={[...MEDIA_SIZES]}
            />
          </label>

          <label
            className="flex flex-col gap-1"
            style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}
          >
            DPI файла
            <OperatorSelect
              value={String(config.dpi)}
              onChange={(value) => patchConfig({ dpi: Number(value) })}
              options={[...DPI_OPTIONS]}
            />
          </label>

          <div className="flex items-center justify-between" style={{ fontSize: "var(--operator-printer-row-font-size)" }}>
            <span style={{ color: "var(--operator-text-muted)" }}>Зеркало для плёнки</span>
            <button
              type="button"
              onClick={() => patchConfig({ mirror: !config.mirror })}
              className="relative flex-shrink-0 overflow-hidden rounded-full transition-colors"
              style={{
                width: "var(--operator-printer-toggle-width)",
                height: "var(--operator-printer-toggle-height)",
                backgroundColor: config.mirror ? "var(--operator-accent)" : "var(--operator-card-border)",
              }}
              aria-pressed={config.mirror}
            >
              <span
                className="absolute rounded-full bg-white transition-[left,right]"
                style={{
                  top: "2px",
                  height: "calc(var(--operator-printer-toggle-height) - 4px)",
                  width: "calc(var(--operator-printer-toggle-height) - 4px)",
                  left: config.mirror ? "auto" : "2px",
                  right: config.mirror ? "2px" : "auto",
                }}
              />
            </button>
          </div>
          <p style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
            Выключите, только если зеркало уже включено в AcroRIP
          </p>

          <label
            className="flex flex-col gap-1"
            style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}
          >
            Изделие (размеры печати)
            <OperatorSelect
              value={GARMENT_LABELS[sizeGarment]}
              onChange={(label) => {
                const entry = (Object.entries(GARMENT_LABELS) as [GarmentType, string][]).find(
                  ([, name]) => name === label,
                );
                if (entry) setSizeGarment(entry[0]);
              }}
              options={Object.values(GARMENT_LABELS)}
            />
          </label>

          <SizeFields label="Перед" value={sideSizes.front} onChange={(next) => patchPrintSize("front", next)} />
          <SizeFields label="Спина" value={sideSizes.back} onChange={(next) => patchPrintSize("back", next)} />

          {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
          {message && (
            <p className="text-sm font-semibold whitespace-pre-line" style={{ color: "var(--operator-printer-ready-color)" }}>
              {message}
            </p>
          )}
          {(saving || dirty) && !message && (
            <p style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
              {saving ? "Сохранение…" : "Есть несохранённые изменения…"}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: "var(--operator-printer-button-font-size)",
              paddingBlock: "var(--operator-printer-button-padding-y)",
              borderRadius: "var(--operator-printer-button-radius)",
              backgroundColor: "var(--operator-page-bg)",
              border: "1px solid var(--operator-card-border)",
              color: "var(--operator-text-muted)",
            }}
          >
            Сбросить к умолчанию
          </button>
        </section>
      </div>

      <div
        className="flex flex-shrink-0 flex-col gap-1 px-1"
        style={{
          marginTop: "var(--operator-printer-section-gap)",
          paddingBottom: "var(--operator-printer-padding-bottom)",
          fontSize: "var(--operator-printer-footer-font-size)",
          color: "var(--operator-text-muted)",
        }}
      >
        <div className="flex justify-between">
          <span>Сегодня готово</span>
          <span className="font-semibold text-white">{doneToday}</span>
        </div>
        <div className="flex justify-between">
          <span>Файлов в папке печати</span>
          <span className="font-semibold text-white">{status?.hotfolder.fileCount ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="flex-shrink-0">Папка</span>
          <span className="truncate font-semibold text-white" title={status?.hotfolderAbsolutePath}>
            {status?.hotfolderAbsolutePath || "—"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5" style={{ borderColor: "var(--operator-card-border)" }}>
          <span>Epson L1800 · DTF</span>
          <span className="flex items-center gap-1 font-semibold" style={{ color: healthColor(health) }}>
            ● {healthLabel(health, windows?.statusText ?? "")}
          </span>
        </div>
      </div>
    </div>
  );
}
