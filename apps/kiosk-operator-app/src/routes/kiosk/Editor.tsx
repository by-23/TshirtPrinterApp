import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { useEditorStore } from "../../editor/store.js";
import { FabricCanvas } from "../../editor/FabricCanvas.js";
import { GarmentPicker } from "../../editor/GarmentPicker.js";
import { TextTool } from "../../editor/toolbar/TextTool.js";
import { StickerPicker } from "../../editor/toolbar/StickerPicker.js";
import { UploadTool } from "../../editor/toolbar/UploadTool.js";
import { ObjectControls } from "../../editor/toolbar/ObjectControls.js";
import {
  GarmentMockup,
  MOCKUP_DISPLAY_SCALE,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  PRINT_AREAS,
} from "../../editor/mockup/index.js";

export function Editor() {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const side = useEditorStore((state) => state.side);
  const color = useEditorStore((state) => state.color);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [showNextNotice, setShowNextNotice] = useState(false);

  const printArea = PRINT_AREAS[garmentType][side];
  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-white p-4">
      <header className="flex items-center justify-between">
        <Link
          to="/kiosk"
          className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          {t("common.back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("editor.title")}</h1>
        <div className="w-20" />
      </header>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64">
          <GarmentPicker />
        </aside>

        <div className="flex flex-1 items-start justify-center">
          <div
            className="relative"
            style={{ width: mockupPixelWidth, height: mockupPixelHeight }}
          >
            <GarmentMockup
              garmentType={garmentType}
              side={side}
              color={color}
              className="absolute inset-0 h-full w-full"
            />
            <div
              className="absolute overflow-hidden"
              style={{
                left: printArea.x * MOCKUP_DISPLAY_SCALE,
                top: printArea.y * MOCKUP_DISPLAY_SCALE,
                width: printArea.width * MOCKUP_DISPLAY_SCALE,
                height: printArea.height * MOCKUP_DISPLAY_SCALE,
              }}
            >
              <FabricCanvas side={side} printArea={printArea} className="h-full w-full" onReady={setCanvas} />
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:w-64">
          <div className="rounded-2xl bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.toolbar.text")}</h3>
            <TextTool canvas={canvas} />
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <StickerPicker canvas={canvas} />
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <UploadTool canvas={canvas} />
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.toolbar.object")}</h3>
            <ObjectControls canvas={canvas} />
          </div>
        </aside>
      </div>

      <footer className="flex flex-col items-center gap-2 pt-4">
        {showNextNotice && <p className="text-sm text-gray-500">{t("editor.nextPlaceholder")}</p>}
        <TouchButton
          onClick={() => setShowNextNotice(true)}
          className="rounded-full bg-black px-8 py-3 text-lg font-semibold text-white hover:bg-gray-800"
        >
          {t("editor.next")}
        </TouchButton>
      </footer>
    </div>
  );
}
