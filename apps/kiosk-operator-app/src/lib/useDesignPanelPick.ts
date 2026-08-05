import { useEffect, useState } from "react";
import { scrollToSection, useOpenSections } from "../components/settingsPanelUi.js";
import { useThemePickMode } from "./themePick.js";

/** Shared pick-mode wiring for kiosk design panels (open gear → click regions). */
export function useDesignPanelPick({
  active,
  rootSelector,
  extraRootSelectors,
  sectionsStorageKey,
}: {
  active: boolean;
  rootSelector: string;
  extraRootSelectors?: string[];
  sectionsStorageKey: string;
}) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sections = useOpenSections(sectionsStorageKey);

  useThemePickMode({
    active,
    rootSelector,
    extraRootSelectors,
    activeSectionId,
    onPick: (sectionId) => {
      setActiveSectionId(sectionId);
      sections.ensureOpen(sectionId);
      requestAnimationFrame(() => scrollToSection(sectionId));
    },
  });

  useEffect(() => {
    if (!active) setActiveSectionId(null);
  }, [active]);

  return { activeSectionId, ...sections };
}
