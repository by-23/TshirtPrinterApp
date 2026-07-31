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

export type PointDesktopApi = {
  isDesktop: true;
  listDisplays: () => Promise<DesktopDisplayInfo[]>;
  getAssignment: () => Promise<{ kioskIndex: number | null; operatorIndex: number | null }>;
  applyDisplays: (assignment: DesktopDisplayAssignment) => Promise<{ ok: boolean }>;
};

declare global {
  interface Window {
    pointDesktop?: PointDesktopApi;
  }
}

export function isPointDesktop(): boolean {
  return Boolean(window.pointDesktop?.isDesktop);
}
