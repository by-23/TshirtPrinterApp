import { useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_GARMENT_AVAILABILITY,
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  garmentTypeSchema,
  type GarmentAvailabilityConfig,
  type GarmentFabric,
  type GarmentSize,
  type GarmentType,
} from "@tshirt/shared-types";
import {
  fetchGarmentAvailabilityConfig,
  updateGarmentAvailabilityConfig,
} from "../../lib/pointServer.js";
import {
  initGarmentAvailabilityConfig,
  subscribeGarmentAvailabilityStore,
  useGarmentAvailabilityStore,
} from "../../lib/garmentAvailabilityStore.js";
import { SpinnerIcon } from "../../components/icons.js";

const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };

const TYPE_LABELS: Record<GarmentType, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};

const COLOR_LABELS: Record<string, string> = {
  white: "Белый",
  black: "Чёрный",
  gray: "Серый",
  cream: "Кремовый",
  pink: "Розовый",
  lightBlue: "Голубой",
  green: "Зелёный",
  yellow: "Жёлтый",
  red: "Красный",
  darkGreen: "Тёмно-зелёный",
  purple: "Фиолетовый",
  navy: "Тёмно-синий",
};

const FABRIC_LABELS: Record<GarmentFabric, string> = {
  cotton: "Хлопок",
  premium: "Премиум",
};

function ToggleRow({
  label,
  checked,
  onChange,
  swatch,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  swatch?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{
        ...CARD_STYLE,
        opacity: disabled ? 0.45 : checked ? 1 : 0.55,
      }}
    >
      {swatch ? (
        <span
          className="h-7 w-7 flex-shrink-0 rounded-md border"
          style={{ backgroundColor: swatch, borderColor: "var(--operator-card-border)" }}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 flex-1">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-pink-500"
      />
      <span className="w-20 text-right text-xs font-medium" style={LABEL_STYLE}>
        {checked ? "Включено" : "Выключено"}
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide" style={LABEL_STYLE}>
        {title}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/**
 * Operator «Материалы» — toggles which garment types, colors, sizes and
 * fabrics stay selectable in the kiosk editor. Disabled options remain
 * visible on the editor but cannot be clicked. When central admin has an
 * active override for this point, the panel is read-only.
 */
export function MaterialsPanel() {
  const [availability, setAvailability] = useState<GarmentAvailabilityConfig>(DEFAULT_GARMENT_AVAILABILITY);
  const [adminOverrideActive, setAdminOverrideActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const storeAvailability = useGarmentAvailabilityStore((state) => state.availability);
  const storeOverride = useGarmentAvailabilityStore((state) => state.adminOverrideActive);

  useEffect(() => {
    initGarmentAvailabilityConfig();
    const unsubscribe = subscribeGarmentAvailabilityStore();
    fetchGarmentAvailabilityConfig()
      .then((config) => {
        setAvailability(config.availability);
        setAdminOverrideActive(config.adminOverrideActive);
        useGarmentAvailabilityStore.getState().setFromEvent({
          availability: config.availability,
          adminOverrideActive: config.adminOverrideActive,
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return unsubscribe;
  }, []);

  useEffect(() => {
    setAvailability(storeAvailability);
    setAdminOverrideActive(storeOverride);
  }, [storeAvailability, storeOverride]);

  function setType(type: GarmentType, enabled: boolean) {
    if (adminOverrideActive) return;
    setAvailability((prev) => ({ ...prev, types: { ...prev.types, [type]: enabled } }));
  }

  function setColor(colorId: string, enabled: boolean) {
    if (adminOverrideActive) return;
    setAvailability((prev) => ({ ...prev, colors: { ...prev.colors, [colorId]: enabled } }));
  }

  function setSize(size: GarmentSize, enabled: boolean) {
    if (adminOverrideActive) return;
    setAvailability((prev) => ({ ...prev, sizes: { ...prev.sizes, [size]: enabled } }));
  }

  function setFabric(fabric: GarmentFabric, enabled: boolean) {
    if (adminOverrideActive) return;
    setAvailability((prev) => ({ ...prev, fabrics: { ...prev.fabrics, [fabric]: enabled } }));
  }

  async function handleSave() {
    if (adminOverrideActive) return;
    setSaving(true);
    setSavedNote(null);
    try {
      const result = await updateGarmentAvailabilityConfig({ availability });
      setAvailability(result.availability);
      setAdminOverrideActive(result.adminOverrideActive);
      useGarmentAvailabilityStore.getState().setFromEvent({
        availability: result.availability,
        adminOverrideActive: result.adminOverrideActive,
      });
      setSavedNote("Сохранено");
    } catch (err) {
      setSavedNote(
        err instanceof Error && err.message === "ADMIN_OVERRIDE_ACTIVE"
          ? "Управляется центральной админкой"
          : "Не удалось сохранить",
      );
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  function handleResetDefaults() {
    if (adminOverrideActive) return;
    setAvailability(DEFAULT_GARMENT_AVAILABILITY);
  }

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm" style={LABEL_STYLE}>
        <SpinnerIcon className="h-5 w-5 animate-spin" />
        Загрузка материалов…
      </div>
    );
  }

  return (
    <div className="app-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white">Материалы</h2>
          <p className="text-sm" style={LABEL_STYLE}>
            Выключенные типы, цвета, размеры и ткани остаются в редакторе киоска, но нажать на них нельзя.
          </p>
          {adminOverrideActive ? (
            <p className="mt-1 text-sm font-semibold" style={{ color: "#ecb9c0" }}>
              Управляется центральной админкой. Локальные изменения недоступны, пока override не будет снят.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {savedNote ? (
            <span
              className="text-sm font-semibold"
              style={{ color: savedNote === "Сохранено" ? "#7ec196" : "#ecb9c0" }}
            >
              {savedNote}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={adminOverrideActive}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" }}
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || adminOverrideActive}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#e91e8c" }}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>

      <Section title="Тип изделия">
        {garmentTypeSchema.options.map((type) => (
          <ToggleRow
            key={type}
            label={TYPE_LABELS[type]}
            checked={availability.types[type] !== false}
            disabled={adminOverrideActive}
            onChange={(enabled) => setType(type, enabled)}
          />
        ))}
      </Section>

      <Section title="Цвета">
        {GARMENT_COLORS.map((color) => (
          <ToggleRow
            key={color.id}
            label={COLOR_LABELS[color.id] ?? color.id}
            swatch={color.hex}
            checked={availability.colors[color.id] !== false}
            disabled={adminOverrideActive}
            onChange={(enabled) => setColor(color.id, enabled)}
          />
        ))}
      </Section>

      <Section title="Размеры">
        {GARMENT_SIZES.map((size) => (
          <ToggleRow
            key={size}
            label={size}
            checked={availability.sizes[size] !== false}
            disabled={adminOverrideActive}
            onChange={(enabled) => setSize(size, enabled)}
          />
        ))}
      </Section>

      <Section title="Материалы">
        {GARMENT_FABRICS.map((fabric) => (
          <ToggleRow
            key={fabric}
            label={FABRIC_LABELS[fabric]}
            checked={availability.fabrics[fabric] !== false}
            disabled={adminOverrideActive}
            onChange={(enabled) => setFabric(fabric, enabled)}
          />
        ))}
      </Section>
    </div>
  );
}
