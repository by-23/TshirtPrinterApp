import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";

export interface UploadToolProps {
  canvas: Canvas | null;
}

const MAX_IMAGE_FRACTION = 0.85;

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
      void FabricImage.fromURL(dataUrl).then((image) => {
        const maxWidth = canvas.getWidth() * MAX_IMAGE_FRACTION;
        const maxHeight = canvas.getHeight() * MAX_IMAGE_FRACTION;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        image.set({
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.requestRenderAll();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <TouchButton
        onClick={() => inputRef.current?.click()}
        className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200"
      >
        {t("editor.toolbar.uploadPhoto")}
      </TouchButton>
    </div>
  );
}
