import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { placeImageCentered } from "../canvasImage.js";

export interface UploadToolProps {
  canvas: Canvas | null;
}

export function UploadTool({ canvas }: UploadToolProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      void FabricImage.fromURL(dataUrl).then((image) => placeImageCentered(canvas, image));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.toolbar.uploadPhoto")}
      </h4>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <TouchButton
        onClick={() => inputRef.current?.click()}
        className="rounded-full bg-neon-pink px-4 py-2 text-sm font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
      >
        {t("editor.toolbar.uploadPhoto")}
      </TouchButton>
    </div>
  );
}
