import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiProvider, AiProvidersAvailability, AiStyle, AiStyleTier } from "@tshirt/shared-types";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { fetchAiProviders, fetchAiStyles, resolveDesignImageUrl } from "../../../lib/pointServer.js";
import { initPricingConfig, usePricingConfigStore } from "../../../lib/pricingConfigStore.js";
import { CircleCheck } from "../../../components/icons.js";

function providerToTier(provider: AiProvider): AiStyleTier {
  return provider === "standard" ? "standard" : "premium";
}

/** Screen 3 ("Выберите стиль") — compact photo, provider filters, style grid. */
export function AiStyleSelect() {
  const { t } = useTranslation();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const selectedStyleKey = useAiFlowStore((state) => state.selectedStyleKey);
  const setSelectedStyleKey = useAiFlowStore((state) => state.setSelectedStyleKey);
  const aiProvider = useAiFlowStore((state) => state.aiProvider);
  const setAiProvider = useAiFlowStore((state) => state.setAiProvider);
  const removeBackground = useAiFlowStore((state) => state.removeBackground);
  const setRemoveBackground = useAiFlowStore((state) => state.setRemoveBackground);
  const setStep = useAiFlowStore((state) => state.setStep);
  const error = useAiFlowStore((state) => state.error);
  const priceConfig = usePricingConfigStore((state) => state.config);
  const [styles, setStyles] = useState<AiStyle[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [providers, setProviders] = useState<AiProvidersAvailability>({ chatgpt: false, gemini: false });

  useEffect(() => {
    void initPricingConfig();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAiProviders()
      .then((result) => {
        if (!cancelled) setProviders(result);
      })
      .catch(() => {
        if (!cancelled) setProviders({ chatgpt: false, gemini: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setStyles([]);
    fetchAiStyles(providerToTier(aiProvider))
      .then((result) => {
        if (!cancelled) setStyles(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [aiProvider]);

  const surchargeMap = priceConfig.aiProviderSurchargeTenge ?? { standard: 0, chatgpt: 1500, gemini: 1500 };
  const surcharge = surchargeMap[aiProvider] ?? 0;
  const isPremium = aiProvider !== "standard";

  const filters: Array<{ id: AiProvider; available: boolean }> = [
    { id: "standard", available: true },
    { id: "chatgpt", available: providers.chatgpt },
    { id: "gemini", available: providers.gemini },
  ];

  const stylizeLabel =
    surcharge > 0
      ? `${t("ai.style.stylize")} · +${surcharge.toLocaleString("ru-RU")} ₸`
      : t("ai.style.stylize");

  return (
    <div className="ai-style-screen">
      <div className="ai-style-header">
        <h1 className="ai-style-header-title">{t("ai.style.title")}</h1>
        <p className="ai-style-header-subtitle">{t("ai.style.subtitle")}</p>
      </div>

      <div className="ai-style-photo-row">
        {sourcePhoto ? <img src={sourcePhoto} alt="" className="ai-style-photo" /> : null}
        <div className="ai-style-photo-meta">
          <span className="ai-style-photo-badge">
            {t("ai.style.photoLoaded")}
            <CircleCheck aria-hidden className="ai-style-photo-badge-icon" />
          </span>
          <label className="ai-style-bg-option">
            <input
              type="checkbox"
              checked={removeBackground}
              onChange={(event) => setRemoveBackground(event.target.checked)}
              className="ai-style-bg-option-input"
            />
            <span className="ai-style-bg-option-surface">
              <span className="ai-style-bg-option-mark" aria-hidden>
                <CircleCheck className="ai-style-bg-option-mark-icon" />
              </span>
              <span className="ai-style-bg-option-label">{t("ai.style.removeBackground")}</span>
            </span>
          </label>
        </div>
      </div>

      {error ? <p className="ai-style-error">{error}</p> : null}

      <div className="ai-style-toolbar">
        <h2 className="ai-style-toolbar-title">{t("ai.style.chooseStyle")}</h2>
        <div className="ai-style-filters" role="tablist" aria-label={t("ai.style.providerTitle")}>
          {filters.map((filter) => {
            const selected = aiProvider === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={!filter.available}
                onClick={() => setAiProvider(filter.id)}
                className={`ai-style-filter${selected ? " ai-style-filter--active" : ""}${
                  !filter.available ? " ai-style-filter--disabled" : ""
                }`}
              >
                <span className="ai-style-filter-label">{t(`ai.style.filters.${filter.id}`)}</span>
                {filter.id !== "standard" ? (
                  <span className="ai-style-filter-badge">{t("ai.style.qualityBadge")}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {isPremium ? <p className="ai-style-premium-hint">{t("ai.style.premiumHint")}</p> : null}

      <div className="ai-style-cards">
        {styles.map((style) => {
          const selected = style.key === selectedStyleKey;
          return (
            <button
              key={style.key}
              type="button"
              onClick={() => setSelectedStyleKey(style.key)}
              className={`ai-style-card${selected ? " ai-style-card--selected" : ""}`}
            >
              <img className="ai-style-card-preview" src={resolveDesignImageUrl(style.previewUrl)} alt="" />
              <span className="ai-style-card-title">{style.label}</span>
              {selected ? (
                <span className="ai-style-card-check" aria-hidden>
                  <CircleCheck className="ai-style-card-check-icon" />
                </span>
              ) : null}
            </button>
          );
        })}
        {loadError ? <p className="ai-style-load-error">{t("ai.style.loadError")}</p> : null}
        {!loadError && styles.length === 0 ? (
          <p className="ai-style-load-error">{t("ai.style.emptyStyles")}</p>
        ) : null}
      </div>

      <div className="ai-style-info-bar">
        <div className="ai-style-info-item">
          <span className="ai-style-info-title">{t("ai.style.info.builtinTitle")}</span>
          <span className="ai-style-info-text">{t("ai.style.info.builtinText")}</span>
        </div>
        <div className="ai-style-info-item">
          <span className="ai-style-info-title">{t("ai.style.info.premiumTitle")}</span>
          <span className="ai-style-info-text">{t("ai.style.info.premiumText")}</span>
        </div>
        <div className="ai-style-info-item">
          <span className="ai-style-info-title">{t("ai.style.info.timeTitle")}</span>
          <span className="ai-style-info-text">{t("ai.style.info.timeText")}</span>
        </div>
      </div>

      <div className="ai-style-footer">
        <button type="button" onClick={() => setStep("source")} className="ai-style-back-btn">
          {t("common.back")}
        </button>
        <button
          type="button"
          onClick={() => setStep("processing")}
          disabled={!selectedStyleKey}
          className="ai-style-stylize-btn"
        >
          {stylizeLabel}
        </button>
      </div>
    </div>
  );
}
