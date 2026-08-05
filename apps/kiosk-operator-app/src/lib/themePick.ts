import { useEffect, useRef } from "react";

/** Attribute marking a page region that maps to a design-panel accordion section. */
export const THEME_SECTION_ATTR = "data-theme-section";

/** Marks the currently picked region while pick mode is active. */
export const THEME_SECTION_ACTIVE_ATTR = "data-theme-section-active";

/** Class toggled on the screen root while a design panel is open for picking. */
export const THEME_PICK_ACTIVE_CLASS = "theme-pick-active";

/** Floating design-panel chrome — clicks here must not trigger pick. */
export const THEME_PANEL_CHROME_ATTR = "data-theme-panel-chrome";

export function themeSectionProps(sectionId: string): { [THEME_SECTION_ATTR]: string } {
  return { [THEME_SECTION_ATTR]: sectionId };
}

function isThemePanelChrome(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`[${THEME_PANEL_CHROME_ATTR}]`));
}

function findThemeSection(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest(`[${THEME_SECTION_ATTR}]`);
}

function queryRoots(rootSelector: string, extraRootSelectors: string[]): HTMLElement[] {
  const roots: HTMLElement[] = [];
  const primary = document.querySelector(rootSelector);
  if (primary instanceof HTMLElement) roots.push(primary);
  for (const selector of extraRootSelectors) {
    for (const el of document.querySelectorAll(selector)) {
      if (el instanceof HTMLElement && !roots.includes(el)) roots.push(el);
    }
  }
  return roots;
}

/**
 * While `active`, outline `[data-theme-section]` regions under `rootSelector`
 * (and optional extra roots) and route capture-phase clicks to `onPick`.
 */
export function useThemePickMode({
  active,
  rootSelector,
  extraRootSelectors = [],
  activeSectionId,
  onPick,
}: {
  active: boolean;
  rootSelector: string;
  /** Additional containers that participate in pick (e.g. home language switcher). */
  extraRootSelectors?: string[];
  activeSectionId: string | null;
  onPick: (sectionId: string) => void;
}) {
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const roots = queryRoots(rootSelector, extraRootSelectors);
    if (roots.length === 0) return;

    function clearActiveMarks() {
      for (const root of roots) {
        root.classList.remove(THEME_PICK_ACTIVE_CLASS);
        for (const el of root.querySelectorAll(`[${THEME_SECTION_ACTIVE_ATTR}]`)) {
          el.removeAttribute(THEME_SECTION_ACTIVE_ATTR);
        }
        if (root.hasAttribute(THEME_SECTION_ATTR)) {
          root.removeAttribute(THEME_SECTION_ACTIVE_ATTR);
        }
      }
    }

    if (!active) {
      clearActiveMarks();
      return;
    }

    for (const root of roots) {
      root.classList.add(THEME_PICK_ACTIVE_CLASS);
      const candidates = [
        ...(root.hasAttribute(THEME_SECTION_ATTR) ? [root] : []),
        ...root.querySelectorAll(`[${THEME_SECTION_ATTR}]`),
      ];
      for (const el of candidates) {
        if (!(el instanceof HTMLElement)) continue;
        if (activeSectionId && el.getAttribute(THEME_SECTION_ATTR) === activeSectionId) {
          el.setAttribute(THEME_SECTION_ACTIVE_ATTR, "1");
        } else {
          el.removeAttribute(THEME_SECTION_ACTIVE_ATTR);
        }
      }
    }

    function isInsidePickRoots(node: Node): boolean {
      return roots.some((root) => root === node || root.contains(node));
    }

    function onPointerDown(event: PointerEvent) {
      if (isThemePanelChrome(event.target)) return;
      const section = findThemeSection(event.target);
      if (!section || !isInsidePickRoots(section)) return;
      const sectionId = section.getAttribute(THEME_SECTION_ATTR);
      if (!sectionId) return;
      event.preventDefault();
      event.stopPropagation();
      onPickRef.current(sectionId);
    }

    function onClick(event: MouseEvent) {
      if (isThemePanelChrome(event.target)) return;
      const section = findThemeSection(event.target);
      if (!section || !isInsidePickRoots(section)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    for (const root of roots) {
      root.addEventListener("pointerdown", onPointerDown, true);
      root.addEventListener("click", onClick, true);
    }
    return () => {
      clearActiveMarks();
      for (const root of roots) {
        root.removeEventListener("pointerdown", onPointerDown, true);
        root.removeEventListener("click", onClick, true);
      }
    };
  }, [active, rootSelector, activeSectionId, extraRootSelectors.join("|")]);
}
