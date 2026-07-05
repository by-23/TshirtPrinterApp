import { Fragment, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import {
  ArrowUpLeft,
  Crop,
  RAIL_ICON_CLASS,
  Redo2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
  Upload,
  Image as ImageIcon,
  Smile,
} from "../../components/icons.js";
import { TextTool } from "./TextTool.js";
import { StickerPicker } from "./StickerPicker.js";
import { UploadTool } from "./UploadTool.js";
import { blockBorderStyle, dividerStyle } from "../borderStyle.js";

export interface ToolRailProps {
  canvas: Canvas | null;
}

type PopoverTool = "text" | "upload" | "stickers";

interface RailButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

function RailButton({ icon, label, active = false, className = "", disabled, style, ...rest }: RailButtonProps) {
  const buttonStyle: CSSProperties = {
    height: "var(--editor-rail-btn-height)",
    borderRadius: "var(--editor-rail-btn-radius)",
    backgroundColor: active ? "var(--editor-rail-active-bg)" : "var(--editor-rail-idle-bg)",
    color: active ? "#ffffff" : "var(--editor-rail-idle-text)",
    ...style,
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      style={buttonStyle}
      className={`flex w-full flex-col items-center justify-center gap-1.5 px-2 text-center font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "shadow-neon-pink" : "hover:brightness-125"
      } ${className}`}
      {...rest}
    >
      <span
        className="flex items-center justify-center leading-none"
        style={{
          width: "calc(var(--editor-rail-icon-size) * 1.25)",
          height: "calc(var(--editor-rail-icon-size) * 1.25)",
          fontSize: "var(--editor-rail-icon-size)",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: "var(--editor-rail-label-size)", lineHeight: 1.1 }}>{label}</span>
    </button>
  );
}

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

  const buttons: { key: string; node: ReactNode }[] = [
    {
      key: "select",
      node: (
        <RailButton
          icon={<ArrowUpLeft className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.select")}
          active={openTool === null}
          onClick={() => setOpenTool(null)}
        />
      ),
    },
    {
      key: "text",
      node: (
        <RailButton
          icon={<Type className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.text")}
          active={openTool === "text"}
          onClick={() => toggle("text")}
        />
      ),
    },
    {
      key: "image",
      node: <RailButton icon={<ImageIcon className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.image")} disabled />,
    },
    {
      key: "upload",
      node: (
        <RailButton
          icon={<Upload className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.uploadPhoto")}
          active={openTool === "upload"}
          onClick={() => toggle("upload")}
        />
      ),
    },
    {
      key: "filters",
      node: (
        <RailButton icon={<SlidersHorizontal className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.filters")} disabled />
      ),
    },
    {
      key: "effects",
      node: <RailButton icon={<Sparkles className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.effects")} disabled />,
    },
    {
      key: "stickers",
      node: (
        <RailButton
          icon={<Smile className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.stickers")}
          active={openTool === "stickers"}
          onClick={() => toggle("stickers")}
        />
      ),
    },
    {
      key: "shapes",
      node: <RailButton icon={<Shapes className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.shapes")} disabled />,
    },
    {
      key: "crop",
      node: <RailButton icon={<Crop className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.crop")} disabled />,
    },
    {
      key: "undo",
      node: <RailButton icon={<Undo2 className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.undo")} disabled />,
    },
    {
      key: "redo",
      node: <RailButton icon={<Redo2 className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.redo")} disabled />,
    },
  ];

  return (
    <div className="relative flex flex-col" style={{ gap: "var(--editor-rail-gap)", ...blockBorderStyle("rail-block") }}>
      {buttons.map((button, index) => (
        <Fragment key={button.key}>
          {index > 0 && <div aria-hidden style={dividerStyle("rail")} />}
          {button.node}
        </Fragment>
      ))}

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
