import {
  Fragment,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { IText, type Canvas } from "fabric";
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
import { EDITOR_SELECTION_UI_SELECTOR, EDITOR_TOOL_UI_SELECTOR } from "../canvasSelectionStyle.js";
import { blockBorderStyle, dividerStyle } from "../borderStyle.js";
import { useHistoryStore, undoLastEntry, redoLastEntry } from "../history.js";

export interface ToolRailProps {
  canvas: Canvas | null;
  /** Host under the canvas for compact tools (e.g. text) so they don't cover the mockup. */
  bottomToolDockRef?: RefObject<HTMLElement | null>;
}

type PopoverTool = "text" | "upload" | "emoji" | "filters" | "effects";

/** Tools that dock under the canvas instead of floating next to the rail. */
const BOTTOM_DOCK_TOOLS = new Set<PopoverTool>(["text"]);

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
export function ToolRail({ canvas, bottomToolDockRef }: ToolRailProps) {
  const { t } = useTranslation();
  const [openTool, setOpenTool] = useState<PopoverTool | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [bottomDockEl, setBottomDockEl] = useState<HTMLElement | null>(null);
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const bottomDockedTool = openTool && BOTTOM_DOCK_TOOLS.has(openTool) ? openTool : null;

  useEffect(() => {
    if (!bottomDockedTool) return;
    setBottomDockEl(bottomToolDockRef?.current ?? null);
  }, [bottomToolDockRef, bottomDockedTool]);

  function toggle(tool: PopoverTool) {
    setOpenTool((current) => (current === tool ? null : tool));
  }

  // Tap editable text → open text styles anytime (including re-tap on already-selected text).
  useEffect(() => {
    if (!canvas) return;

    function syncTextPanelOnSelection() {
      const active = canvas!.getActiveObject();
      if (active instanceof IText) {
        setOpenTool("text");
        return;
      }
      setOpenTool((current) => (current === "text" ? null : current));
    }

    // Re-tap on already-selected text does not fire selection:* — reopen styles
    // only when no other tool popover is active (so Effects/Filters stay usable while dragging).
    function handleMouseDown(event: { target?: unknown }) {
      if (!(event.target instanceof IText)) return;
      setOpenTool((current) => (current === null || current === "text" ? "text" : current));
    }

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("selection:created", syncTextPanelOnSelection);
    canvas.on("selection:updated", syncTextPanelOnSelection);
    canvas.on("selection:cleared", syncTextPanelOnSelection);
    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("selection:created", syncTextPanelOnSelection);
      canvas.off("selection:updated", syncTextPanelOnSelection);
      canvas.off("selection:cleared", syncTextPanelOnSelection);
    };
  }, [canvas]);

  useEffect(() => {
    if (!openTool) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        setOpenTool(null);
        return;
      }
      if (target.closest(EDITOR_TOOL_UI_SELECTOR)) return;
      if (target.closest(EDITOR_SELECTION_UI_SELECTOR)) return;

      // Canvas clicks for the text tool are handled by selection sync above:
      // keep the panel when an IText stays/becomes selected, close otherwise.
      if (openTool === "text" && target.closest(".canvas-container")) {
        queueMicrotask(() => {
          const active = canvas?.getActiveObject();
          if (!(active instanceof IText)) setOpenTool(null);
        });
        return;
      }

      setOpenTool(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openTool, canvas]);

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
              {openTool === button.key && !BOTTOM_DOCK_TOOLS.has(button.key) && (
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

      {bottomDockedTool &&
        bottomDockEl &&
        createPortal(
          <div
            data-editor-tool-ui
            className="editor-tool-popover editor-tool-popover--bottom border border-ink-600 bg-ink-900 shadow-xl"
          >
            {POPOVER_CONTENT[bottomDockedTool](canvas)}
          </div>,
          bottomDockEl,
        )}

      {imagePickerOpen && <ImagePickerModal canvas={canvas} onClose={() => setImagePickerOpen(false)} />}
    </div>
  );
}
