import { useState, type CSSProperties } from "react";
import { CircleCheck, Droplet, Printer } from "../../components/icons.js";
import { OperatorSelect } from "../../components/OperatorSelect.js";

const PRINT_MODES = ["Стандартный (720×1200)", "Черновой (360×720)", "Фото (1440×2880)"];
const QUALITY_LEVELS = ["Высокое", "Среднее", "Экономичное"];
const COLOR_PROFILES = ["Ярче цвета", "Нейтральный", "Приглушённый"];

const INK_LEVELS = [
  { label: "Белый", hex: "#f4f4f4" },
  { label: "Голубой", hex: "#22d3f5" },
  { label: "Пурпурный", hex: "#ec4899" },
  { label: "Жёлтый", hex: "#eab308" },
];

const DEFAULTS = { mode: PRINT_MODES[0]!, quality: QUALITY_LEVELS[0]!, profile: COLOR_PROFILES[0]!, pretreat: true };

const sectionStyle: CSSProperties = {
  padding: "var(--operator-printer-section-padding)",
  borderRadius: "var(--operator-printer-section-radius)",
  backgroundColor: "var(--operator-card-bg)",
  border: "1px solid var(--operator-card-border)",
};

/**
 * Right-hand printer panel from `docs/ui-mockups/operator.png`. Purely
 * decorative per the Stage 5 scope decision — there's no real printer
 * integration yet, so ink levels/settings are static and "Сбросить
 * настройки" just resets this panel's own local state. Sizes/spacing are
 * `--operator-printer-*` CSS tokens, live tunable via `OperatorThemePanel`.
 */
export function PrinterPanel({ doneToday }: { doneToday: number }) {
  const [mode, setMode] = useState(DEFAULTS.mode);
  const [quality, setQuality] = useState(DEFAULTS.quality);
  const [profile, setProfile] = useState(DEFAULTS.profile);
  const [pretreat, setPretreat] = useState(DEFAULTS.pretreat);

  function reset() {
    setMode(DEFAULTS.mode);
    setQuality(DEFAULTS.quality);
    setProfile(DEFAULTS.profile);
    setPretreat(DEFAULTS.pretreat);
  }

  const innerGap = "var(--operator-printer-inner-gap)";

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
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
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
            style={{ fontSize: "var(--operator-printer-status-size)", color: "var(--operator-printer-ready-color)" }}
          >
            <CircleCheck className="h-4 w-4" />
            Готов к печати
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
          <span className="font-semibold text-white" style={{ fontSize: "var(--operator-printer-name-size)" }}>
            Brother GTX Pro
          </span>
        </div>

        <div>
          <p className="mb-1 font-semibold" style={{ fontSize: "var(--operator-printer-ink-label-size)", color: "var(--operator-text-muted)" }}>
            Чернила
          </p>
          <div className="grid grid-cols-4 gap-2">
            {INK_LEVELS.map((ink) => (
              <div key={ink.label} className="flex flex-col items-center gap-1">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: "var(--operator-printer-ink-circle-size)",
                    height: "var(--operator-printer-ink-circle-size)",
                    border: `2px solid ${ink.hex}`,
                  }}
                >
                  <Droplet
                    style={{ width: "var(--operator-printer-ink-icon-size)", height: "var(--operator-printer-ink-icon-size)", color: ink.hex }}
                  />
                </div>
                <span className="font-bold text-white" style={{ fontSize: "var(--operator-printer-ink-value-size)" }}>
                  100%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ fontSize: "var(--operator-printer-row-font-size)" }}>
          <span style={{ color: "var(--operator-text-muted)" }}>Обслуживание</span>
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--operator-printer-ready-color)" }}>
            <CircleCheck className="h-4 w-4" />
            Все системы в норме
          </span>
        </div>

        <button
          type="button"
          className="font-bold uppercase tracking-wide text-white"
          style={{
            fontSize: "var(--operator-printer-button-font-size)",
            paddingBlock: "var(--operator-printer-button-padding-y)",
            borderRadius: "var(--operator-printer-button-radius)",
            backgroundColor: "var(--operator-page-bg)",
            border: "1px solid var(--operator-card-border)",
          }}
        >
          Тест дюз
        </button>
      </section>

      <section className="flex flex-col" style={{ ...sectionStyle, gap: innerGap }}>
        <h3
          className="font-bold uppercase tracking-wide"
          style={{ fontSize: "var(--operator-printer-heading-size)", color: "var(--operator-text-muted)" }}
        >
          Настройки печати
        </h3>

        <label className="flex flex-col gap-1" style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}>
          Режим печати
          <OperatorSelect value={mode} onChange={setMode} options={PRINT_MODES} />
        </label>

        <label className="flex flex-col gap-1" style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}>
          Качество
          <OperatorSelect value={quality} onChange={setQuality} options={QUALITY_LEVELS} />
        </label>

        <label className="flex flex-col gap-1" style={{ fontSize: "var(--operator-printer-row-font-size)", color: "var(--operator-text-muted)" }}>
          Цветовой профиль
          <OperatorSelect value={profile} onChange={setProfile} options={COLOR_PROFILES} />
        </label>

        <div className="flex items-center justify-between" style={{ fontSize: "var(--operator-printer-row-font-size)" }}>
          <span style={{ color: "var(--operator-text-muted)" }}>Предобработка</span>
          <button
            type="button"
            onClick={() => setPretreat((value) => !value)}
            className="relative flex-shrink-0 overflow-hidden rounded-full transition-colors"
            style={{
              width: "var(--operator-printer-toggle-width)",
              height: "var(--operator-printer-toggle-height)",
              backgroundColor: pretreat ? "var(--operator-accent)" : "var(--operator-card-border)",
            }}
          >
            <span
              className="absolute rounded-full bg-white transition-[left,right]"
              style={{
                top: "2px",
                height: "calc(var(--operator-printer-toggle-height) - 4px)",
                width: "calc(var(--operator-printer-toggle-height) - 4px)",
                left: pretreat ? "auto" : "2px",
                right: pretreat ? "2px" : "auto",
              }}
            />
          </button>
        </div>

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
          Сбросить настройки
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
          <span>Сегодня напечатано</span>
          <span className="font-semibold text-white">{doneToday}</span>
        </div>
        <div className="flex justify-between">
          <span>Чернил израсходовано</span>
          <span className="font-semibold text-white">— мл</span>
        </div>
        <div className="flex justify-between">
          <span>Среднее время печати</span>
          <span className="font-semibold text-white">— мин</span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5" style={{ borderColor: "var(--operator-card-border)" }}>
          <span>Версия 1.0.0</span>
          <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--operator-printer-ready-color)" }}>
            ● Онлайн
          </span>
        </div>
      </div>
    </div>
  );
}
