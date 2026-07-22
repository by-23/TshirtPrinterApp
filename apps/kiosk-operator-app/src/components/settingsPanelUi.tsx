import { useState, type ReactNode } from "react";
import { ChevronDown } from "./icons.js";

function loadOpenSections(storageKey: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Persisted open/closed state for accordion sections inside a design panel.
 * Each panel should pass its own `storageKey` so states don't collide.
 */
export function useOpenSections(storageKey: string) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    loadOpenSections(storageKey),
  );

  function isOpen(id: string, defaultOpen = false) {
    return openSections[id] ?? defaultOpen;
  }

  function toggle(id: string, defaultOpen = false) {
    setOpenSections((prev) => {
      const currentlyOpen = prev[id] ?? defaultOpen;
      const next = { ...prev, [id]: !currentlyOpen };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return { isOpen, toggle };
}

/** Stable id for a settings accordion section keyed by its title. */
export function settingsSectionId(title: string) {
  return `section-${title}`;
}

/** Small uppercase label that heads a group of accordion sections. */
export function SettingsPanelGroupLabel({ children }: { children: ReactNode }) {
  return (
    <span className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-white/35">
      {children}
    </span>
  );
}

/** Wrapper for a labelled group of collapsible settings sections. */
export function SettingsPanelGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SettingsPanelGroupLabel>{label}</SettingsPanelGroupLabel>
      {children}
    </div>
  );
}

/**
 * Collapsible category block used by every kiosk/operator design panel.
 * Click the header to expand/collapse; optional `nested` for subsections.
 */
export function SettingsPanelSection({
  id,
  title,
  open,
  onToggle,
  children,
  nested = false,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <div
      className={
        nested
          ? "overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
          : "overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.03]"
      }
    >
      <button
        type="button"
        id={`${id}-header`}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-white/[0.04] ${
          nested ? "px-4 py-3" : "px-5 py-4"
        }`}
      >
        <span
          className={`font-bold uppercase tracking-wider ${
            nested ? "text-sm text-white/45" : "text-base text-white/70"
          }`}
        >
          {title}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-5 w-5 shrink-0 text-white/45 transition-transform duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
          strokeWidth={2}
        />
      </button>
      {open ? (
        <div
          id={`${id}-body`}
          role="region"
          aria-labelledby={`${id}-header`}
          className={`flex flex-col gap-5 border-t border-white/10 ${nested ? "px-4 py-4" : "px-5 py-5"}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Look up sections by title list (preserves order). Missing titles are skipped.
 */
export function pickSectionsByTitle<T extends { title: string }>(
  sections: T[],
  titles: readonly string[],
): T[] {
  const byTitle = new Map(sections.map((section) => [section.title, section]));
  return titles.flatMap((title) => {
    const section = byTitle.get(title);
    return section ? [section] : [];
  });
}
