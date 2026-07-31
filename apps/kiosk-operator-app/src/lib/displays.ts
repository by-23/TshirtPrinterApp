import { KIOSK_WINDOW_NAME, kioskReleaseUrl, setReleaseMode } from "./releaseMode.js";

const ASSIGNMENT_KEY = "tshirt.displayAssignment";

export type DisplayInfo = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary: boolean;
  isCurrent: boolean;
  isPortrait: boolean;
};

export type DisplayAssignment = {
  kioskScreenId: string | null;
  operatorScreenId: string | null;
};

type ScreenLike = {
  left: number;
  top: number;
  width: number;
  height: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
  label?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type ScreenDetailsLike = {
  screens: ScreenLike[];
  currentScreen: ScreenLike;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetailsLike>;
  }

  interface FullscreenOptions {
    screen?: ScreenLike;
  }
}

function screenId(screen: ScreenLike, index: number): string {
  return `${screen.left},${screen.top},${screen.width}x${screen.height}#${index}`;
}

function toDisplayInfo(screen: ScreenLike, index: number, current: ScreenLike | null): DisplayInfo {
  const label =
    screen.label?.trim() ||
    (screen.isPrimary ? `Монитор ${index + 1} (основной)` : `Монитор ${index + 1}`);
  return {
    id: screenId(screen, index),
    label,
    left: screen.left,
    top: screen.top,
    width: screen.width,
    height: screen.height,
    availLeft: screen.availLeft,
    availTop: screen.availTop,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    isPrimary: Boolean(screen.isPrimary),
    isCurrent: current
      ? screen.left === current.left && screen.top === current.top && screen.width === current.width
      : false,
    isPortrait: screen.height > screen.width,
  };
}

function fallbackDisplays(): DisplayInfo[] {
  const s = window.screen;
  const availLeft = "availLeft" in s && typeof s.availLeft === "number" ? s.availLeft : 0;
  const availTop = "availTop" in s && typeof s.availTop === "number" ? s.availTop : 0;
  const screen: ScreenLike = {
    left: availLeft,
    top: availTop,
    width: s.width,
    height: s.height,
    availLeft,
    availTop,
    availWidth: s.availWidth,
    availHeight: s.availHeight,
    isPrimary: true,
    label: "Этот монитор",
  };
  return [toDisplayInfo(screen, 0, screen)];
}

/** Lists connected displays. Prefers the Window Management API when permitted. */
export async function listDisplays(): Promise<{ displays: DisplayInfo[]; advanced: boolean }> {
  if (typeof window.getScreenDetails === "function") {
    try {
      const details = await window.getScreenDetails();
      const current = details.currentScreen;
      return {
        advanced: true,
        displays: details.screens.map((screen, index) => toDisplayInfo(screen, index, current)),
      };
    } catch {
      // Permission denied or unsupported — fall through.
    }
  }
  return { displays: fallbackDisplays(), advanced: false };
}

export function loadDisplayAssignment(): DisplayAssignment {
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_KEY);
    if (!raw) return { kioskScreenId: null, operatorScreenId: null };
    const parsed = JSON.parse(raw) as DisplayAssignment;
    return {
      kioskScreenId: typeof parsed.kioskScreenId === "string" ? parsed.kioskScreenId : null,
      operatorScreenId: typeof parsed.operatorScreenId === "string" ? parsed.operatorScreenId : null,
    };
  } catch {
    return { kioskScreenId: null, operatorScreenId: null };
  }
}

export function saveDisplayAssignment(assignment: DisplayAssignment): void {
  try {
    window.localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignment));
  } catch {
    // ignore
  }
}

function findScreen(details: ScreenDetailsLike, id: string | null): ScreenLike | null {
  if (!id) return null;
  const match = details.screens.find((screen, index) => screenId(screen, index) === id);
  return match ?? null;
}

/** Fill monitor and request browser fullscreen (removes title bar / borders). */
async function placeWindow(win: Window, screen: ScreenLike): Promise<void> {
  // Fill the whole monitor first, then enter browser fullscreen so OS/browser
  // chrome (title bar, borders) disappears on both kiosk and operator.
  try {
    win.moveTo(screen.availLeft, screen.availTop);
    win.resizeTo(screen.availWidth, screen.availHeight);
  } catch {
    // Cross-screen move may require Window Management permission already granted.
  }

  try {
    const el = win.document.documentElement;
    if (win.document.fullscreenElement !== el) {
      await el.requestFullscreen({ screen });
    }
  } catch {
    // Gesture restrictions — window is still sized to the monitor.
  }
}

function openOrFocusKiosk(screen?: ScreenLike | null): Window | null {
  const features = screen
    ? [
        `left=${screen.availLeft}`,
        `top=${screen.availTop}`,
        `width=${screen.availWidth}`,
        `height=${screen.availHeight}`,
        "popup=yes",
      ].join(",")
    : "popup=yes";

  const win = window.open(kioskReleaseUrl(), KIOSK_WINDOW_NAME, features);
  if (win) win.focus();
  return win;
}

/**
 * Applies saved monitor roles: both windows go frameless fullscreen on their
 * assigned screens (kiosk canvas stays 1080×1920 portrait inside the display).
 */
export async function applyDisplayAssignment(assignment: DisplayAssignment): Promise<void> {
  setReleaseMode(true);
  saveDisplayAssignment(assignment);

  if (typeof window.getScreenDetails !== "function") {
    await document.documentElement.requestFullscreen().catch(() => undefined);
    const kioskWin = openOrFocusKiosk();
    if (kioskWin) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!kioskWin.closed) {
        await kioskWin.document.documentElement.requestFullscreen().catch(() => undefined);
      }
    }
    return;
  }

  const details = await window.getScreenDetails();
  const operatorScreen =
    findScreen(details, assignment.operatorScreenId) ?? details.currentScreen ?? details.screens[0];
  const kioskScreen =
    findScreen(details, assignment.kioskScreenId) ??
    details.screens.find((s) => s !== operatorScreen && s.height > s.width) ??
    details.screens.find((s) => s !== operatorScreen) ??
    operatorScreen;

  if (operatorScreen) {
    await placeWindow(window, operatorScreen);
  }

  const kioskWin = openOrFocusKiosk(kioskScreen);
  if (!kioskWin || !kioskScreen) return;

  // Wait a tick so the kiosk document can load before move/fullscreen.
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (kioskWin.closed) return;
  await placeWindow(kioskWin, kioskScreen);
}

/** Enter fullscreen on the current document (release boot helper). */
export async function enterReleaseFullscreen(): Promise<void> {
  if (document.fullscreenElement) return;
  try {
    if (typeof window.getScreenDetails === "function") {
      const details = await window.getScreenDetails();
      await document.documentElement.requestFullscreen({ screen: details.currentScreen });
      return;
    }
  } catch {
    // fall through
  }
  await document.documentElement.requestFullscreen().catch(() => undefined);
}
