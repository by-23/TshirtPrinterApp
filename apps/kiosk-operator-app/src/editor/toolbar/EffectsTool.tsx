import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IText, type Canvas, type FabricObject } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { applyEffects, DEFAULT_EFFECTS_STATE, EFFECTS_PRESETS, type EffectsState } from "../effects.js";
import { recordHistoryEntry } from "../history.js";
import { ColorPickerPopover } from "./ColorPickerPopover.js";

export interface EffectsToolProps {
  canvas: Canvas | null;
}

/** Runtime-only, mirrors `__filterState` in `FiltersTool.tsx` — re-populates the tool when re-selecting an object already touched this session. */
interface FabricObjectWithEffectsState extends FabricObject {
  __effectsState?: EffectsState;
}

const GRADIENT_DIRECTIONS: EffectsState["gradientDirection"][] = ["horizontal", "vertical", "diagonal"];

export function EffectsTool({ canvas }: EffectsToolProps) {
  const { t } = useTranslation();
  const [activeObject, setActiveObject] = useState<FabricObjectWithEffectsState | null>(null);
  const [state, setState] = useState<EffectsState>(DEFAULT_EFFECTS_STATE);
  const isText = activeObject instanceof IText;

  useEffect(() => {
    if (!canvas) return;
    function refresh() {
      const active = canvas!.getActiveObject() as FabricObjectWithEffectsState | null;
      setActiveObject(active);
      if (active) {
        const existing = active.__effectsState;
        if (existing) {
          setState(existing);
        } else {
          const currentFill = typeof active.fill === "string" ? active.fill : DEFAULT_EFFECTS_STATE.plainFill;
          setState({ ...DEFAULT_EFFECTS_STATE, opacity: active.opacity ?? 1, plainFill: currentFill });
        }
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

  function commit(next: EffectsState) {
    if (!activeObject || !canvas) return;
    setState(next);
    applyEffects(activeObject, next);
    activeObject.__effectsState = next;
    canvas.requestRenderAll();
    recordHistoryEntry(canvas);
  }

  function update(patch: Partial<EffectsState>) {
    commit({ ...state, ...patch });
  }

  function toggleGradient(enabled: boolean) {
    if (enabled && activeObject) {
      const currentFill = typeof activeObject.fill === "string" ? activeObject.fill : state.plainFill;
      update({ gradientEnabled: true, plainFill: currentFill });
    } else {
      update({ gradientEnabled: false });
    }
  }

  function applyPreset(id: keyof typeof EFFECTS_PRESETS) {
    commit({ ...state, ...EFFECTS_PRESETS[id].state });
  }

  if (!activeObject) {
    return (
      <div className="editor-tool-panel">
        <h4 className="editor-tool-title">{t("editor.toolbar.effects")}</h4>
        <p className="editor-tool-body text-ink-300">{t("editor.toolbar.effectsList.selectObjectHint")}</p>
      </div>
    );
  }

  return (
    <div className="editor-tool-panel max-h-[70vh] overflow-y-auto">
      <h4 className="editor-tool-title">{t("editor.toolbar.effects")}</h4>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(EFFECTS_PRESETS) as (keyof typeof EFFECTS_PRESETS)[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => applyPreset(id)}
            className="editor-tool-chip bg-ink-800 text-ink-200 transition-colors hover:bg-ink-700 hover:text-white"
          >
            {t(EFFECTS_PRESETS[id].labelKey)}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-2 border-t border-ink-700 pt-3">
        <label className="editor-tool-label flex items-center justify-between font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.toolbar.effectsList.shadow")}
          <input
            type="checkbox"
            checked={state.shadowEnabled}
            onChange={(event) => update({ shadowEnabled: event.target.checked })}
            className="editor-tool-checkbox accent-neon-pink"
          />
        </label>
        {state.shadowEnabled && (
          <div className="flex flex-col gap-2 pl-1">
            <div className="flex items-center gap-2">
              <span className="editor-tool-caption text-ink-300">{t("editor.toolbar.effectsList.color")}</span>
              <ColorPickerPopover color={state.shadowColor} onChange={(color) => update({ shadowColor: color })} />
            </div>
            {(["shadowBlur", "shadowOffsetX", "shadowOffsetY"] as const).map((field) => (
              <label key={field} className="editor-tool-label flex flex-col gap-1.5 text-ink-200">
                <span className="flex items-center justify-between">
                  <span>{t(`editor.toolbar.effectsList.${field}`)}</span>
                  <span>{state[field]}</span>
                </span>
                <input
                  type="range"
                  min={field === "shadowBlur" ? 0 : -30}
                  max={30}
                  step={1}
                  value={state[field]}
                  onChange={(event) => update({ [field]: Number(event.target.value) } as Partial<EffectsState>)}
                  className="h-8 w-full accent-neon-pink"
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-ink-700 pt-3">
        <label className="editor-tool-label flex items-center justify-between font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.toolbar.effectsList.stroke")}
          <input
            type="checkbox"
            checked={state.strokeEnabled}
            onChange={(event) => update({ strokeEnabled: event.target.checked })}
            className="editor-tool-checkbox accent-neon-pink"
          />
        </label>
        {state.strokeEnabled && (
          <div className="flex flex-col gap-2 pl-1">
            <div className="flex items-center gap-2">
              <span className="editor-tool-caption text-ink-300">{t("editor.toolbar.effectsList.color")}</span>
              <ColorPickerPopover color={state.strokeColor} onChange={(color) => update({ strokeColor: color })} />
            </div>
            {isText && (
              <label className="editor-tool-label flex flex-col gap-1.5 text-ink-200">
                <span className="flex items-center justify-between">
                  <span>{t("editor.toolbar.effectsList.strokeWidth")}</span>
                  <span>{state.strokeWidth}</span>
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={state.strokeWidth}
                  onChange={(event) => update({ strokeWidth: Number(event.target.value) })}
                  className="h-8 w-full accent-neon-pink"
                />
              </label>
            )}
            {!isText && <p className="editor-tool-caption text-ink-400">{t("editor.toolbar.effectsList.strokeImageHint")}</p>}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-ink-700 pt-3">
        <label className="editor-tool-label flex flex-col gap-1.5 text-ink-200">
          <span className="flex items-center justify-between font-semibold uppercase tracking-wide">
            <span>{t("editor.toolbar.effectsList.opacity")}</span>
            <span>{Math.round(state.opacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.opacity}
            onChange={(event) => update({ opacity: Number(event.target.value) })}
            className="h-8 w-full accent-neon-pink"
          />
        </label>
      </section>

      {isText && (
        <section className="flex flex-col gap-2 border-t border-ink-700 pt-3">
          <label className="editor-tool-label flex items-center justify-between font-semibold uppercase tracking-wide text-ink-200">
            {t("editor.toolbar.effectsList.gradient")}
            <input
              type="checkbox"
              checked={state.gradientEnabled}
              onChange={(event) => toggleGradient(event.target.checked)}
              className="editor-tool-checkbox accent-neon-pink"
            />
          </label>
          {state.gradientEnabled && (
            <div className="flex flex-col gap-2 pl-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="editor-tool-caption text-ink-300">{t("editor.toolbar.effectsList.from")}</span>
                  <ColorPickerPopover color={state.gradientFrom} onChange={(color) => update({ gradientFrom: color })} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="editor-tool-caption text-ink-300">{t("editor.toolbar.effectsList.to")}</span>
                  <ColorPickerPopover color={state.gradientTo} onChange={(color) => update({ gradientTo: color })} />
                </div>
              </div>
              <div className="flex gap-2">
                {GRADIENT_DIRECTIONS.map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => update({ gradientDirection: direction })}
                    aria-pressed={state.gradientDirection === direction}
                    className={`editor-tool-chip flex-1 transition-colors ${
                      state.gradientDirection === direction ? "bg-neon-pink text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700"
                    }`}
                  >
                    {t(`editor.toolbar.effectsList.direction.${direction}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <TouchButton
        onClick={() => commit({ ...DEFAULT_EFFECTS_STATE, plainFill: state.plainFill })}
        className="editor-tool-btn bg-ink-800 text-white transition-colors hover:bg-ink-700"
      >
        {t("editor.toolbar.effectsList.reset")}
      </TouchButton>
    </div>
  );
}
