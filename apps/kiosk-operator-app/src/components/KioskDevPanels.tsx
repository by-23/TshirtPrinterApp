import { ThemePanel } from "./ThemePanel.js";
import { EditorThemePanel } from "./EditorThemePanel.js";
import { CheckoutThemePanel } from "./CheckoutThemePanel.js";
import { GalleryThemePanel } from "./GalleryThemePanel.js";
import { AiThemePanel } from "./AiThemePanel.js";
import { DevViewSwitcher } from "./DevViewSwitcher.js";

/** Dev-only theme + view switcher chunk — imported only when `!release`. */
export function KioskDevPanels() {
  return (
    <>
      <ThemePanel />
      <EditorThemePanel />
      <CheckoutThemePanel />
      <GalleryThemePanel />
      <AiThemePanel />
      <DevViewSwitcher />
    </>
  );
}
