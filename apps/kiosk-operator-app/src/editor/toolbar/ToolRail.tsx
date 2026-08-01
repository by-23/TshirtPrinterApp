import { Fragment, useEffect, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import {
  ArrowUpLeft,
  Crop,
  RAIL_ICON_CLASS,
  Redo2,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
  Upload,
  Image as ImageIcon,
  Smile,
} from "../../components/icons.js";
import { TextTool } from "./TextTool.js";
import { EmojiPicker } from "./EmojiPicker.js";
import { UploadTool } from "./UploadTool.js";
import { FiltersTool } from "./FiltersTool.js";
import { EffectsTool } from "./EffectsTool.js";
import { ImagePickerModal } from "./ImagePickerModal.js";
import { DraggableToolPopover } from "./DraggableToolPopover.js";
import { EDITOR_TOOL_UI_SELECTOR } from "../canvasSelectionStyle.js";
import { blockBorderStyle, dividerStyle } from "../borderStyle.js";
import { useHistoryStore, undoLastEntry, redoLastEntry } from "../history.js";

export interface ToolRailProps {
  canvas: Canvas | null;
}

type PopoverTool = "text" | "upload" | "emoji" | "filters" | "effects";

const POPOVER_CONTENT: Record<PopoverTool, (canvas: Canvas | null) => ReactNode> = {
  text: (canvas) => <TextTool canvas={canvas} />,
  upload: (canvas) => <UploadTool canvas={canvas} />,
  emoji: (canvas) => <EmojiPicker canvas={canvas} />,
  filters: (canvas) => <FiltersTool canvas={canvas} />,
  effects: (canvas) => <EffectsTool canvas={canvas} />,
};

function isPopoverTool(key: string): key is PopoverTool {
  return key in POPOVER_CONTENT;
}

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

/** Left vertical icon rail from `docs/ui-mockups/editor.png` — all tools are fully wired up (see docs/PLAN.md). */
export function ToolRail({ canvas }: ToolRailProps) {
  const { t } = useTranslation();
  const [openTool, setOpenTool] = useState<PopoverTool | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);

  function toggle(tool: PopoverTool) {
    setOpenTool((current) => (current === tool ? null : tool));
  }

  useEffect(() => {
    if (!openTool) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(EDITOR_TOOL_UI_SELECTOR)) return;
      setOpenTool(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openTool]);

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
      node: (
        <RailButton
          icon={<ImageIcon className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.image")}
          onClick={() => setImagePickerOpen(true)}
        />
      ),
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
        <RailButton
          icon={<SlidersHorizontal className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.filters")}
          active={openTool === "filters"}
          onClick={() => toggle("filters")}
        />
      ),
    },
    {
      key: "effects",
      node: (
        <RailButton
          icon={<Sparkles className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.effects")}
          active={openTool === "effects"}
          onClick={() => toggle("effects")}
        />
      ),
    },
    {
      key: "emoji",
      node: (
        <RailButton
          icon={<Smile className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.emoji")}
          active={openTool === "emoji"}
          onClick={() => toggle("emoji")}
        />
      ),
    },
    {
      key: "crop",
      node: <RailButton icon={<Crop className={RAIL_ICON_CLASS} />} label={t("editor.toolbar.crop")} disabled />,
    },
    {
      key: "undo",
      node: (
        <RailButton
          icon={<Undo2 className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.undo")}
          disabled={!canUndo}
          onClick={() => canvas && void undoLastEntry(canvas)}
        />
      ),
    },
    {
      key: "redo",
      node: (
        <RailButton
          icon={<Redo2 className={RAIL_ICON_CLASS} />}
          label={t("editor.toolbar.redo")}
          disabled={!canRedo}
          onClick={() => canvas && void redoLastEntry(canvas)}
        />
      ),
    },
  ];

  return (
    <div
      data-editor-tool-ui
      className="relative flex flex-col"
      style={{ gap: "var(--editor-rail-gap)", ...blockBorderStyle("rail-block") }}
    >
      {buttons.map((button, index) => (
        <Fragment key={button.key}>
          {index > 0 && <div aria-hidden style={dividerStyle("rail")} />}
          {isPopoverTool(button.key) ? (
            <div className="relative">
              {button.node}
              {openTool === button.key && (
                <DraggableToolPopover
                  key={button.key}
                  className={button.key === "emoji" ? "editor-tool-popover--emoji" : undefined}
                >
                  {POPOVER_CONTENT[button.key](canvas)}
                </DraggableToolPopover>
              )}
            </div>
          ) : (
            button.node
          )}
        </Fragment>
      ))}

      {imagePickerOpen && <ImagePickerModal canvas={canvas} onClose={() => setImagePickerOpen(false)} />}
    </div>
  );
}
