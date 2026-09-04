import { create } from "zustand";
import type { Canvas } from "fabric";
import type { GarmentSide } from "@tshirt/shared-types";
import { applySelectionStyleToAllObjects } from "./canvasSelectionStyle.js";
import { snapshotCanvasJson } from "./applyGarmentClipToCanvas.js";
import { syncPrintSizeFromCanvas } from "./printSize.js";
import { applySelectionControlOverscan } from "./selectionControlOverscan.js";
import { useEditorStore } from "./store.js";
import { discardCanvasSession } from "./canvasSession.js";

/**
 * Undo/redo history — a JSON snapshot stack **per print side**, so undoing on
 * the front never touches back-side history and vice versa (docs/PLAN.md
 * "Отменить / Повторить"). Kept as module-level state (not React state) since
 * it must survive `FabricCanvas` remounts — reads/writes `side` from
 * `editor/store.ts` directly rather than taking it as a parameter, so every
 * call site (toolbar buttons, `FabricCanvas`'s own event handlers) always
 * targets whichever side is actually on screen.
 */
const MAX_HISTORY_STEPS = 30;

interface SideHistory {
  undoStack: string[];
  redoStack: string[];
}

const historyBySide = new Map<GarmentSide, SideHistory>();
const currentJsonBySide = new Map<GarmentSide, string | null>();

/**
 * Set while a snapshot is being programmatically loaded (initial mount, side
 * switch, undo, redo) — `canvas.clear()`/`loadFromJSON()` fire the same
 * `object:added`/`object:removed` events a real user edit would, and without
 * this guard every one of those would get recorded as its own bogus history
 * step instead of being the *result* of an undo/redo/side-switch.
 */
let suspended = false;

/**
 * Guards `undoLastEntry`/`redoLastEntry` against overlapping calls. Both
 * functions call `restoreSnapshot`, which does `canvas.clear()` followed by
 * an *awaited* `canvas.loadFromJSON()` — genuinely async. The undo/redo
 * toolbar buttons stay enabled during that gap (their `canUndo`/`canRedo`
 * flags only refresh once the restore finishes), so a quick double-click or
 * a burst of "undo several steps" clicks used to fire a second restore
 * before the first one's `loadFromJSON` resolved. The second `clear()` would
 * cut off the first load mid-flight, and the first call would then finish by
 * writing its own (now-stale) snapshot into `currentJsonBySide`, leaving the
 * canvas's real object list out of sync with what history thought was
 * current. Selection-dependent UI (e.g. the floating delete button in
 * `ObjectControls`) would keep referencing a stale active object that
 * `canvas.remove()` silently no-ops on, making delete look like it "stopped
 * working". Ignoring extra undo/redo requests while one is in flight avoids
 * the corruption entirely.
 */
let restoreInFlight = false;

interface HistoryFlagsState {
  canUndo: boolean;
  canRedo: boolean;
}

export const useHistoryStore = create<HistoryFlagsState>(() => ({ canUndo: false, canRedo: false }));

function getHistory(side: GarmentSide): SideHistory {
  let history = historyBySide.get(side);
  if (!history) {
    history = { undoStack: [], redoStack: [] };
    historyBySide.set(side, history);
  }
  return history;
}

function refreshFlags(): void {
  const side = useEditorStore.getState().side;
  const history = historyBySide.get(side);
  useHistoryStore.setState({
    canUndo: (history?.undoStack.length ?? 0) > 0,
    canRedo: (history?.redoStack.length ?? 0) > 0,
  });
}

export function isHistorySuspended(): boolean {
  return suspended;
}

export function setHistorySuspended(next: boolean): void {
  suspended = next;
}

/** Establishes the baseline state for `side` (initial mount / after switching sides) without pushing an undo step. */
export function initHistoryForSide(side: GarmentSide, json: string): void {
  currentJsonBySide.set(side, json);
  historyBySide.set(side, { undoStack: [], redoStack: [] });
  refreshFlags();
}

/**
 * Records one history step for the *current* side. Called after any
 * user-driven canvas mutation — both the native Fabric events
 * (`object:added`/`removed`/`modified`, wired up in `FabricCanvas.tsx`) and
 * programmatic changes that don't fire those (toolbar steppers, filters,
 * effects, text style tweaks — those call this directly).
 */
export function recordHistoryEntry(canvas: Canvas): void {
  if (suspended) return;
  const side = useEditorStore.getState().side;
  const nextJson = snapshotCanvasJson(canvas);
  const previousJson = currentJsonBySide.get(side) ?? null;
  if (previousJson === nextJson) return;

  const history = getHistory(side);
  if (previousJson !== null) {
    history.undoStack.push(previousJson);
    if (history.undoStack.length > MAX_HISTORY_STEPS) history.undoStack.shift();
  }
  history.redoStack = [];
  currentJsonBySide.set(side, nextJson);
  refreshFlags();
}

async function restoreSnapshot(canvas: Canvas, side: GarmentSide, json: string): Promise<void> {
  setHistorySuspended(true);
  try {
    canvas.clear();
    await canvas.loadFromJSON(json);
    applySelectionControlOverscan(canvas);
    applySelectionStyleToAllObjects(canvas);
    canvas.requestRenderAll();
    syncPrintSizeFromCanvas(side, canvas);
    currentJsonBySide.set(side, json);
  } finally {
    setHistorySuspended(false);
  }
}

export async function undoLastEntry(canvas: Canvas): Promise<void> {
  if (restoreInFlight) return;
  const side = useEditorStore.getState().side;
  const history = getHistory(side);
  const previousJson = history.undoStack.pop();
  if (previousJson === undefined) return;
  const currentJson = currentJsonBySide.get(side) ?? snapshotCanvasJson(canvas);
  history.redoStack.push(currentJson);
  restoreInFlight = true;
  try {
    await restoreSnapshot(canvas, side, previousJson);
  } finally {
    restoreInFlight = false;
  }
  refreshFlags();
}

export async function redoLastEntry(canvas: Canvas): Promise<void> {
  if (restoreInFlight) return;
  const side = useEditorStore.getState().side;
  const history = getHistory(side);
  const nextJson = history.redoStack.pop();
  if (nextJson === undefined) return;
  const currentJson = currentJsonBySide.get(side) ?? snapshotCanvasJson(canvas);
  history.undoStack.push(currentJson);
  restoreInFlight = true;
  try {
    await restoreSnapshot(canvas, side, nextJson);
  } finally {
    restoreInFlight = false;
  }
  refreshFlags();
}

/** Called alongside `useEditorStore.getState().reset()` so a new customer starts with clean undo history. */
export function resetAllHistory(): void {
  historyBySide.clear();
  currentJsonBySide.clear();
  useHistoryStore.setState({ canUndo: false, canRedo: false });
}

/** Checkout "Назад" keeps the current garment — session id stays the same. */
export function keepEditorSession(): void {
  // Snapshots stay; the live canvas may persist into the same session.
}

/** Clears garment options, canvas snapshots and undo stacks. */
export function resetEditorSession(): void {
  discardCanvasSession();
  useEditorStore.getState().reset();
  resetAllHistory();
}
