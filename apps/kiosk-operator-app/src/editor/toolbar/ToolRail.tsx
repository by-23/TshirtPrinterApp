import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import { IconToolButton } from "@tshirt/ui-kit";
import { TextTool } from "./TextTool.js";
import { StickerPicker } from "./StickerPicker.js";
import { UploadTool } from "./UploadTool.js";

export interface ToolRailProps {
  canvas: Canvas | null;
}

type PopoverTool = "text" | "upload" | "stickers";

/**
 * Left vertical icon rail from `docs/ui-mockups/editor.png`. Tools already
 * implemented in Stage 2 (Text/Upload/Stickers) open as a floating popover
 * reusing the existing tool components; tools outside Stage 2's scope
 * (Filters/Effects/Shapes/Crop/Undo/Redo) are shown per the mockup layout
 * but disabled until their own stage lands.
 */
export function ToolRail({ canvas }: ToolRailProps) {
  const { t } = useTranslation();
  const [openTool, setOpenTool] = useState<PopoverTool | null>(null);

  function toggle(tool: PopoverTool) {
    setOpenTool((current) => (current === tool ? null : tool));
  }

  return (
    <div className="relative flex flex-col gap-2">
      <IconToolButton
        icon={<span aria-hidden>↖</span>}
        label={t("editor.toolbar.select")}
        active={openTool === null}
        onClick={() => setOpenTool(null)}
      />
      <IconToolButton
        icon={<span aria-hidden>Tt</span>}
        label={t("editor.toolbar.text")}
        active={openTool === "text"}
        onClick={() => toggle("text")}
      />
      <IconToolButton icon={<span aria-hidden>🖼</span>} label={t("editor.toolbar.image")} disabled />
      <IconToolButton
        icon={<span aria-hidden>⬆</span>}
        label={t("editor.toolbar.uploadPhoto")}
        active={openTool === "upload"}
        onClick={() => toggle("upload")}
      />
      <IconToolButton icon={<span aria-hidden>◐</span>} label={t("editor.toolbar.filters")} disabled />
      <IconToolButton icon={<span aria-hidden>✦</span>} label={t("editor.toolbar.effects")} disabled />
      <IconToolButton
        icon={<span aria-hidden>☺</span>}
        label={t("editor.toolbar.stickers")}
        active={openTool === "stickers"}
        onClick={() => toggle("stickers")}
      />
      <IconToolButton icon={<span aria-hidden>▲</span>} label={t("editor.toolbar.shapes")} disabled />
      <IconToolButton icon={<span aria-hidden>⛶</span>} label={t("editor.toolbar.crop")} disabled />

      <div className="my-1 border-t border-ink-700" />

      <IconToolButton icon={<span aria-hidden>↺</span>} label={t("editor.toolbar.undo")} disabled />
      <IconToolButton icon={<span aria-hidden>↻</span>} label={t("editor.toolbar.redo")} disabled />

      {openTool && (
        <div className="absolute left-full top-0 z-20 ml-3 w-64 rounded-2xl border border-ink-600 bg-ink-900 p-4 shadow-xl">
          {openTool === "text" && <TextTool canvas={canvas} />}
          {openTool === "upload" && <UploadTool canvas={canvas} />}
          {openTool === "stickers" && <StickerPicker canvas={canvas} />}
        </div>
      )}
    </div>
  );
}
