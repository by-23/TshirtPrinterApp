import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IText, type Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { TEXT_COLORS } from "../types.js";
import { getDesignAreaSize } from "../selectionControlOverscan.js";
import { ColorPickerPopover } from "./ColorPickerPopover.js";
import { recordHistoryEntry } from "../history.js";
import {
  EDITOR_FONTS,
  applyManagedFonts,
  type FontOption,
} from "../../lib/fonts.js";
import { fetchFonts, resolveDesignImageUrl, subscribeFontsEvents } from "../../lib/pointServer.js";

export interface TextToolProps {
  canvas: Canvas | null;
}

const DEFAULT_FONT_SIZE = 120;

function readFillColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function TextTool({ canvas }: TextToolProps) {
  const { t } = useTranslation();
  const [fonts, setFonts] = useState<FontOption[]>(EDITOR_FONTS);
  const [fontFamily, setFontFamily] = useState(EDITOR_FONTS[0]!.family);
  const [color, setColor] = useState(TEXT_COLORS[0]!);

  useEffect(() => {
    let cancelled = false;

    function applyList(managed: Awaited<ReturnType<typeof fetchFonts>>) {
      if (cancelled) return;
      const next = applyManagedFonts(managed, resolveDesignImageUrl);
      if (next.length > 0) {
        setFonts(next);
        setFontFamily((current) =>
          next.some((font) => font.family === current) ? current : next[0]!.family,
        );
      }
    }

    void fetchFonts()
      .then(applyList)
      .catch(() => {
        // Fail-open: keep bundled EDITOR_FONTS when point-server is unreachable.
      });

    const unsubscribe = subscribeFontsEvents(applyList);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!canvas) return;

    function syncFromSelection() {
      const active = canvas!.getActiveObject();
      if (!(active instanceof IText)) return;
      if (active.fontFamily) setFontFamily(active.fontFamily);
      setColor(readFillColor(active.fill, TEXT_COLORS[0]!));
    }

    syncFromSelection();
    canvas.on("selection:created", syncFromSelection);
    canvas.on("selection:updated", syncFromSelection);
    canvas.on("selection:cleared", syncFromSelection);
    return () => {
      canvas.off("selection:created", syncFromSelection);
      canvas.off("selection:updated", syncFromSelection);
      canvas.off("selection:cleared", syncFromSelection);
    };
  }, [canvas]);

  function applyToSelection(props: Partial<{ fontFamily: string; fill: string }>) {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && active instanceof IText) {
      active.set(props);
      canvas.requestRenderAll();
      recordHistoryEntry(canvas);
    }
  }

  function handleFontChange(family: string) {
    setFontFamily(family);
    applyToSelection({ fontFamily: family });
  }

  function handleColorChange(nextColor: string) {
    setColor(nextColor);
    applyToSelection({ fill: nextColor });
  }

  function addText() {
    if (!canvas) return;
    const { width, height } = getDesignAreaSize(canvas);
    const text = new IText(t("editor.toolbar.textPlaceholder"), {
      left: width / 2,
      top: height / 2,
      originX: "center",
      originY: "center",
      fontFamily,
      fill: color,
      fontSize: DEFAULT_FONT_SIZE,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    canvas.requestRenderAll();
  }

  return (
    <div className="editor-tool-panel editor-tool-panel--text-compact">
      <div className="editor-tool-font-row">
        {fonts.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => handleFontChange(font.family)}
            aria-pressed={fontFamily === font.family}
            style={{ fontFamily: font.family }}
            className={`editor-tool-font-chip shrink-0 transition-colors ${
              fontFamily === font.family
                ? "bg-neon-pink text-white"
                : "bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white"
            }`}
          >
            {font.label}
          </button>
        ))}
      </div>
      <div className="editor-tool-color-bar">
        <TouchButton
          onClick={addText}
          className="editor-tool-btn editor-tool-text-add-btn shrink-0 bg-neon-pink text-white shadow-neon-pink transition-transform hover:scale-105"
        >
          {t("editor.toolbar.addText")}
        </TouchButton>
        <div className="editor-tool-color-row">
          {TEXT_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleColorChange(option)}
              aria-pressed={color === option}
              className={`editor-tool-swatch shrink-0 rounded-full border-2 ${color === option ? "border-neon-pink" : "border-ink-600"}`}
              style={{ backgroundColor: option }}
            />
          ))}
          <ColorPickerPopover color={color} onChange={handleColorChange} />
        </div>
      </div>
    </div>
  );
}
