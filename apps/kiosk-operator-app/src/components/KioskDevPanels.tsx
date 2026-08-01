import { ThemePanel } from "./ThemePanel.js";
import { EditorThemePanel } from "./EditorThemePanel.js";
import { CheckoutThemePanel } from "./CheckoutThemePanel.js";
import { GalleryThemePanel } from "./GalleryThemePanel.js";
import { AiThemePanel } from "./AiThemePanel.js";

/** Opt-in design panels (`?dev=1`) — no kiosk/operator view switcher. */
export function KioskDevPanels() {
  return (
    <>
      <ThemePanel />
      <EditorThemePanel />
      <CheckoutThemePanel />
      <GalleryThemePanel />
      <AiThemePanel />
    </>
  );
}
