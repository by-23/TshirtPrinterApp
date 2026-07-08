import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IText, type Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { FONTS, TEXT_COLORS } from "../types.js";
import { ColorPickerPopover } from "./ColorPickerPopover.js";
import { recordHistoryEntry } from "../history.js";

export interface TextToolProps {
  canvas: Canvas | null;
}

export function TextTool({ canvas }: TextToolProps) {
  const { t } = useTranslation();
  const [fontFamily, setFontFamily] = useState(FONTS[0]!.family);
  const [color, setColor] = useState(TEXT_COLORS[0]!);

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
    const text = new IText(t("editor.toolbar.textPlaceholder"), {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      fontFamily,
      fill: color,
      fontSize: 32,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  }

  return (
    <div className="editor-tool-panel">
      <h4 className="editor-tool-title">{t("editor.toolbar.text")}</h4>
      <TouchButton
        onClick={addText}
        className="editor-tool-btn bg-neon-pink text-white shadow-neon-pink transition-transform hover:scale-105"
      >
        {t("editor.toolbar.addText")}
      </TouchButton>
      <div className="flex flex-wrap gap-2">
        {FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => handleFontChange(font.family)}
            aria-pressed={fontFamily === font.family}
            style={{ fontFamily: font.family }}
            className={`editor-tool-font-chip transition-colors ${
              fontFamily === font.family
                ? "bg-neon-pink text-white"
                : "bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white"
            }`}
          >
            {font.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TEXT_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleColorChange(option)}
            aria-pressed={color === option}
            className={`editor-tool-swatch rounded-full border-2 ${color === option ? "border-neon-pink" : "border-ink-600"}`}
            style={{ backgroundColor: option }}
          />
        ))}
        <ColorPickerPopover color={color} onChange={handleColorChange} />
      </div>
    </div>
  );
}
