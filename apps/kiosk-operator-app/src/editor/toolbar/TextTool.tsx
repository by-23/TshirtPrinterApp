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
    <div className="flex flex-col gap-2">
      <TouchButton
        onClick={addText}
        className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200"
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
              fontFamily === font.family ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-200"
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
            className={`h-7 w-7 rounded-full border-2 ${color === option ? "border-black" : "border-gray-200"}`}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
    </div>
  );
}
