import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IText, type Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { FONTS, TEXT_COLORS } from "../types.js";

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
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.toolbar.text")}
      </h4>
      <TouchButton
        onClick={addText}
        className="rounded-full bg-neon-pink px-4 py-2 text-sm font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
      >
        {t("editor.toolbar.addText")}
      </TouchButton>
      <div className="flex flex-wrap gap-1">
        {FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => handleFontChange(font.family)}
            aria-pressed={fontFamily === font.family}
            style={{ fontFamily: font.family }}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              fontFamily === font.family
                ? "bg-neon-pink text-white"
                : "bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white"
            }`}
          >
            {font.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {TEXT_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleColorChange(option)}
            aria-pressed={color === option}
            className={`h-7 w-7 rounded-full border-2 ${color === option ? "border-neon-pink" : "border-ink-600"}`}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
    </div>
  );
}
