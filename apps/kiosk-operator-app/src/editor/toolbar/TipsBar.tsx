import { useTranslation } from "react-i18next";
import { Camera, Image, SlidersHorizontal, Target, type LucideIcon } from "lucide-react";
import { bottomStripLayoutStyle } from "../borderStyle.js";

const TIP_ICONS: LucideIcon[] = [Image, Target, SlidersHorizontal, Camera];

/** Static tips strip at the bottom of the editor, matching the reference mockup. */
export function TipsBar() {
  const { t } = useTranslation();
  const tips = t("editor.tips", { returnObjects: true }) as string[];

  return (
    <div className="flex flex-col gap-3" style={bottomStripLayoutStyle("tips-block")}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.tipsTitle")}
      </h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        {tips.map((tip, index) => {
          const TipIcon = TIP_ICONS[index % TIP_ICONS.length]!;
          return (
            <div
              key={tip}
              className="flex items-center gap-3 text-ink-200 sm:max-w-[23%]"
              style={{ fontSize: "var(--editor-tips-text-size)" }}
            >
              <span
                aria-hidden
                className="flex flex-shrink-0 items-center justify-center"
                style={{
                  width: "var(--editor-tips-icon-width)",
                  height: "var(--editor-tips-icon-height)",
                  borderRadius: "var(--editor-tips-icon-radius)",
                  backgroundColor: "var(--editor-tips-icon-bg)",
                }}
              >
                <TipIcon className="h-[1.1em] w-[1.1em]" strokeWidth={1.8} />
              </span>
              <span>{tip}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
