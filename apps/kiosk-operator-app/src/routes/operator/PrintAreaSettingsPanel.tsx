import { useEffect, useState } from "react";
import {
  DEFAULT_PRINT_AREAS,
  type GarmentSide,
  type GarmentType,
  type PrintAreaConfig,
  type PrintAreaRect,
} from "@tshirt/shared-types";
import { PrintAreaEditor } from "../../editor/mockup/PrintAreaEditor.js";
import { fetchPrintAreaConfig, updatePrintAreaConfig } from "../../lib/pointServer.js";
import { initPrintAreaConfig, usePrintAreaStore } from "../../lib/printAreaStore.js";
import { RotateCw, SpinnerIcon, Target } from "../../components/icons.js";

const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const INPUT_STYLE = { backgroundColor: "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };

const GARMENT_LABELS: Record<GarmentType, string> = {
  tshirt: "Футболка",
  hoodie: "Худи",
};

const SIDE_LABELS: Record<GarmentSide, string> = {
  front: "Перед",
  back: "Спина",
};

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={LABEL_STYLE}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-lg px-3 py-2 text-white outline-none"
        style={INPUT_STYLE}
      />
    </label>
  );
}

/**
 * Operator «Настройки печати» — visual editor for the printable rectangle
 * per garment type and side. Saved to point-server so kiosk editor and order
 * compositing stay in sync.
 */
export function PrintAreaSettingsPanel() {
  const [areas, setAreas] = useState<PrintAreaConfig>(DEFAULT_PRINT_AREAS);
  const [loaded, setLoaded] = useState(false);
  const [garmentType, setGarmentType] = useState<GarmentType>("tshirt");
  const [side, setSide] = useState<GarmentSide>("front");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    initPrintAreaConfig();
    fetchPrintAreaConfig()
      .then((config) => {
        setAreas(config.areas);
        usePrintAreaStore.getState().setAreas(config.areas);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const currentRect = areas[garmentType][side];

  function updateCurrentRect(next: PrintAreaRect) {
    setAreas((prev) => ({
      ...prev,
      [garmentType]: { ...prev[garmentType], [side]: next },
    }));
  }

  function updateField(field: keyof PrintAreaRect, raw: number) {
    if (!Number.isFinite(raw)) return;
    updateCurrentRect({ ...currentRect, [field]: raw });
  }

  async function handleSave() {
    setSaving(true);
    setSavedNote(null);
    try {
      const result = await updatePrintAreaConfig({ areas });
      setAreas(result.areas);
      usePrintAreaStore.getState().setAreas(result.areas);
      setSavedNote("Сохранено");
    } catch {
      setSavedNote("Не удалось сохранить");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  function handleResetDefaults() {
    setAreas(DEFAULT_PRINT_AREAS);
  }

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm" style={LABEL_STYLE}>
        <SpinnerIcon className="h-5 w-5 animate-spin" />
        Загрузка настроек…
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
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white">Область печати</h2>
            <p className="text-sm" style={LABEL_STYLE}>
              Настройте границы зоны, куда клиент может разместить дизайн
            </p>
          </div>
        </div>
        {savedNote && (
          <span className="text-sm font-semibold" style={{ color: savedNote === "Сохранено" ? "#3ecf5f" : "#f14668" }}>
            {savedNote}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex flex-1 flex-col items-center gap-4 rounded-xl p-6" style={CARD_STYLE}>
          <div className="flex flex-wrap justify-center gap-2">
            {(Object.keys(GARMENT_LABELS) as GarmentType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setGarmentType(type)}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: garmentType === type ? "var(--operator-accent)" : "var(--operator-page-bg)",
                  color: garmentType === type ? "#fff" : "var(--operator-text-muted)",
                  border: garmentType === type ? "none" : "1px solid var(--operator-card-border)",
                }}
              >
                {GARMENT_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(Object.keys(SIDE_LABELS) as GarmentSide[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSide(value)}
                className="rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: side === value ? "var(--operator-accent-soft)" : "transparent",
                  color: side === value ? "var(--operator-accent)" : "var(--operator-text-muted)",
                  border: `1px solid ${side === value ? "var(--operator-accent)" : "var(--operator-card-border)"}`,
                }}
              >
                {SIDE_LABELS[value]}
              </button>
            ))}
          </div>

          <PrintAreaEditor
            garmentType={garmentType}
            side={side}
            rect={currentRect}
            onChange={updateCurrentRect}
          />
        </div>

        <div className="flex w-full flex-col gap-4 rounded-xl p-5 xl:max-w-sm" style={CARD_STYLE}>
          <h3 className="font-semibold text-white">Точные координаты</h3>
          <p className="text-xs leading-relaxed" style={LABEL_STYLE}>
            Координаты в единицах мокапа (300×340). Можно править вручную или перетаскивать зону на превью слева.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <NumericField label="X (слева)" value={Math.round(currentRect.x)} onChange={(v) => updateField("x", v)} />
            <NumericField label="Y (сверху)" value={Math.round(currentRect.y)} onChange={(v) => updateField("y", v)} />
            <NumericField label="Ширина" value={Math.round(currentRect.width)} onChange={(v) => updateField("width", v)} />
            <NumericField
              label="Высота"
              value={Math.round(currentRect.height)}
              onChange={(v) => updateField("height", v)}
            />
          </div>

          <div
            className="rounded-lg px-4 py-3 text-sm leading-relaxed"
            style={{ backgroundColor: "var(--operator-page-bg)", color: "var(--operator-text-muted)" }}
          >
            <strong className="text-white">Подсказка:</strong> зона печати должна лежать на груди/спине футболки, не
            заходя на рукава и ворот. После сохранения изменения сразу применятся в редакторе киоска.
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "var(--operator-accent)" }}
            >
              {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
              Сохранить настройки
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: "var(--operator-page-bg)",
                color: "var(--operator-text-muted)",
                border: "1px solid var(--operator-card-border)",
              }}
            >
              <RotateCw className="h-4 w-4" />
              Сбросить к умолчанию
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
