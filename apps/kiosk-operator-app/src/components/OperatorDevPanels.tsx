import { OperatorThemePanel } from "./OperatorThemePanel.js";
import { DevViewSwitcher } from "./DevViewSwitcher.js";

/** Dev-only operator chrome — separate chunk, never fetched in release. */
export function OperatorDevPanels() {
  return (
    <>
      <OperatorThemePanel />
      <DevViewSwitcher />
    </>
  );
}
