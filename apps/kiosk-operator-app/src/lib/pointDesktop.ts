export type DesktopDisplayInfo = {
  id: string;
  index: number;
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
  isPortrait: boolean;
};

export type DesktopDisplayAssignment = {
  kioskIndex: number;
  operatorIndex: number;
};

export type DesktopUpdateStatus = {
  state: string;
  version?: string;
  percent?: number;
  error?: string;
};

export type ModuleZoneId = "ui" | "server" | "runtime";

export type ModuleZoneStatus = {
  id: ModuleZoneId;
  localVersion?: string;
  remoteVersion?: string;
  state: string;
  percent?: number;
  error?: string;
};

export type ModulesUpdateSnapshot = {
  zones: ModuleZoneStatus[];
  error?: string;
};

export type PointDesktopApi = {
  isDesktop: true;
  listDisplays: () => Promise<DesktopDisplayInfo[]>;
  getAssignment: () => Promise<{ kioskIndex: number | null; operatorIndex: number | null }>;
  applyDisplays: (assignment: DesktopDisplayAssignment) => Promise<{ ok: boolean }>;
  /** Reveal a file in Explorer (Windows) / Finder — used for DTF print jobs. */
  showItemInFolder?: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  /** Open a file or folder with the OS default app. */
  openPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
  getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
  installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  checkForUpdate?: () => Promise<{ ok: boolean; error?: string; status?: DesktopUpdateStatus }>;
  onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
  getModulesStatus?: () => Promise<ModulesUpdateSnapshot>;
  checkModuleUpdates?: () => Promise<{ ok: boolean; error?: string; status?: ModulesUpdateSnapshot }>;
  applyModuleUpdate?: (zone: ModuleZoneId) => Promise<{ ok: boolean; error?: string }>;
  onModulesStatus?: (callback: (status: ModulesUpdateSnapshot) => void) => () => void;
};

declare global {
  interface Window {
    pointDesktop?: PointDesktopApi;
  }
}

export function isPointDesktop(): boolean {
  return Boolean(window.pointDesktop?.isDesktop);
}
