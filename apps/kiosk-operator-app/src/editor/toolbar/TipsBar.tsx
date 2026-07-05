import { useTranslation } from "react-i18next";

const TIP_ICONS = ["🖼", "🎯", "◐", "📷"];

/** Static tips strip at the bottom of the editor (`docs/ui-mockups/editor.png`). */
export function TipsBar() {
  const { t } = useTranslation();
  const tips = t("editor.tips", { returnObjects: true }) as string[];

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-3 sm:flex-row sm:justify-between">
      {tips.map((tip, index) => (
        <div key={tip} className="flex items-center gap-2 text-xs text-ink-200">
          <span aria-hidden>{TIP_ICONS[index % TIP_ICONS.length]}</span>
          <span>{tip}</span>
        </div>
      ))}
    </div>
  );
}
