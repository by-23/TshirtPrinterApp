import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import {
  applyImageFilters,
  DEFAULT_IMAGE_FILTER_STATE,
  isImageFilterStateEmpty,
  type ImageFilterState,
} from "../imageFilters.js";
import { recordHistoryEntry } from "../history.js";

export interface FiltersToolProps {
  canvas: Canvas | null;
}

/** Runtime-only — not serialized, just lets the tool re-populate its sliders when re-selecting an already-filtered image within the same session. */
interface FabricImageWithFilterState extends FabricImage {
  __filterState?: ImageFilterState;
}

const TOGGLES: { id: "grayscale" | "sepia" | "invert"; labelKey: string }[] = [
  { id: "grayscale", labelKey: "editor.toolbar.filtersList.grayscale" },
  { id: "sepia", labelKey: "editor.toolbar.filtersList.sepia" },
  { id: "invert", labelKey: "editor.toolbar.filtersList.invert" },
];

const SLIDERS: {
  id: "brightness" | "contrast" | "saturation" | "blur";
  labelKey: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { id: "brightness", labelKey: "editor.toolbar.filtersList.brightness", min: -1, max: 1, step: 0.05 },
  { id: "contrast", labelKey: "editor.toolbar.filtersList.contrast", min: -1, max: 1, step: 0.05 },
  { id: "saturation", labelKey: "editor.toolbar.filtersList.saturation", min: -1, max: 1, step: 0.05 },
  { id: "blur", labelKey: "editor.toolbar.filtersList.blur", min: 0, max: 1, step: 0.05 },
];

const PIXELATE_MAX = 24;

export function FiltersTool({ canvas }: FiltersToolProps) {
  const { t } = useTranslation();
  const [activeImage, setActiveImage] = useState<FabricImageWithFilterState | null>(null);
  const [state, setState] = useState<ImageFilterState>(DEFAULT_IMAGE_FILTER_STATE);

  useEffect(() => {
    if (!canvas) return;
    function refresh() {
      const active = canvas!.getActiveObject();
      if (active instanceof FabricImage) {
        const withState = active as FabricImageWithFilterState;
        setActiveImage(withState);
        setState(withState.__filterState ?? DEFAULT_IMAGE_FILTER_STATE);
      } else {
        setActiveImage(null);
      }
    }
    refresh();
    canvas.on("selection:created", refresh);
    canvas.on("selection:updated", refresh);
    canvas.on("selection:cleared", refresh);
    return () => {
      canvas.off("selection:created", refresh);
      canvas.off("selection:updated", refresh);
      canvas.off("selection:cleared", refresh);
    };
  }, [canvas]);

  function update(patch: Partial<ImageFilterState>) {
    if (!activeImage || !canvas) return;
    const next = { ...state, ...patch };
    setState(next);
    applyImageFilters(activeImage, next);
    activeImage.__filterState = next;
    canvas.requestRenderAll();
    recordHistoryEntry(canvas);
  }

  if (!activeImage) {
    return (
      <div className="editor-tool-panel">
        <h4 className="editor-tool-title">{t("editor.toolbar.filters")}</h4>
        <p className="editor-tool-body text-ink-300">{t("editor.toolbar.filtersList.selectImageHint")}</p>
      </div>
    );
  }

  return (
    <div className="editor-tool-panel max-h-[70vh] overflow-y-auto">
      <h4 className="editor-tool-title">{t("editor.toolbar.filters")}</h4>

      <div className="flex flex-wrap gap-2">
        {TOGGLES.map((toggle) => (
          <button
            key={toggle.id}
            type="button"
            onClick={() => update({ [toggle.id]: !state[toggle.id] } as Partial<ImageFilterState>)}
            aria-pressed={state[toggle.id]}
            className={`editor-tool-chip transition-colors ${
              state[toggle.id] ? "bg-neon-pink text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700"
            }`}
          >
            {t(toggle.labelKey)}
          </button>
        ))}
      </div>

      {SLIDERS.map((slider) => (
        <label key={slider.id} className="editor-tool-label flex flex-col gap-1.5 text-ink-200">
          <span className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wide">{t(slider.labelKey)}</span>
            <span>{state[slider.id].toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={state[slider.id]}
            onChange={(event) => update({ [slider.id]: Number(event.target.value) } as Partial<ImageFilterState>)}
            className="h-8 w-full accent-neon-pink"
          />
        </label>
      ))}

      <label className="editor-tool-label flex flex-col gap-1.5 text-ink-200">
        <span className="flex items-center justify-between">
          <span className="font-semibold uppercase tracking-wide">{t("editor.toolbar.filtersList.pixelate")}</span>
          <span>{state.pixelate === 0 ? t("editor.toolbar.filtersList.off") : state.pixelate}</span>
        </span>
        <input
          type="range"
          min={0}
          max={PIXELATE_MAX}
          step={1}
          value={state.pixelate}
          onChange={(event) => update({ pixelate: Number(event.target.value) })}
          className="h-8 w-full accent-neon-pink"
        />
      </label>

      <TouchButton
        onClick={() => update(DEFAULT_IMAGE_FILTER_STATE)}
        disabled={isImageFilterStateEmpty(state)}
        className="editor-tool-btn bg-ink-800 text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("editor.toolbar.filtersList.reset")}
      </TouchButton>
    </div>
  );
}
