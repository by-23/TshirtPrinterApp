import type { GarmentSide, GarmentType } from "@tshirt/shared-types";

/**
 * Server-side mirror of the mockup geometry used by the kiosk editor
 * (`apps/kiosk-operator-app/src/editor/mockup/garmentShape.ts`). Kept in
 * sync manually — there is no shared package between the two apps for this
 * yet — so that the operator's mockup PNG lines up with what the customer
 * saw while designing.
 */
export const MOCKUP_WIDTH = 300;
export const MOCKUP_HEIGHT = 340;

export interface PrintAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PRINT_AREAS: Record<GarmentType, Record<GarmentSide, PrintAreaRect>> = {
  tshirt: {
    front: { x: 110, y: 115, width: 90, height: 150 },
    back: { x: 100, y: 105, width: 110, height: 175 },
  },
  hoodie: {
    front: { x: 110, y: 118, width: 90, height: 105 },
    back: { x: 100, y: 105, width: 110, height: 175 },
  },
};

const NECKLINE_FRONT = "125,48 150,62 175,48";
const NECKLINE_BACK = "125,46 150,42 175,46";

function bodyPolygonPoints(side: GarmentSide): string {
  const neckline = side === "front" ? NECKLINE_FRONT : NECKLINE_BACK;
  return ["55,70", "95,35", neckline, "205,35", "245,70", "222,118", "205,100", "205,300", "95,300", "95,100", "78,118"].join(
    " ",
  );
}

function collarPath(side: GarmentSide): string {
  return side === "front" ? "M120,46 Q150,58 180,46" : "M120,44 Q150,40 180,44";
}

/**
 * Flat vector hoodie silhouette (mirrors `HoodieMockup.tsx`) rendered to raw
 * SVG markup so `sharp` can rasterize it server-side — the hoodie has no
 * photographed flat-lay asset like the t-shirt does.
 */
export function hoodieSvg(color: string, side: GarmentSide, scale: number): string {
  const width = MOCKUP_WIDTH * scale;
  const height = MOCKUP_HEIGHT * scale;
  const pocket =
    side === "front"
      ? `<rect x="105" y="205" width="90" height="55" rx="12" fill="#00000012" stroke="#00000022" />
         <line x1="140" y1="60" x2="136" y2="92" stroke="#00000055" stroke-width="3" stroke-linecap="round" />
         <circle cx="136" cy="94" r="3" fill="#00000055" />
         <line x1="160" y1="60" x2="164" y2="92" stroke="#00000055" stroke-width="3" stroke-linecap="round" />
         <circle cx="164" cy="94" r="3" fill="#00000055" />`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${MOCKUP_WIDTH} ${MOCKUP_HEIGHT}">
    <path d="M90,45 Q150,-15 210,45 Q190,65 150,58 Q110,65 90,45 Z" fill="${color}" stroke="#00000022" stroke-width="2" />
    <polygon points="${bodyPolygonPoints(side)}" fill="${color}" stroke="#00000022" stroke-width="2" />
    <path d="${collarPath(side)}" fill="none" stroke="#00000033" stroke-width="6" stroke-linecap="round" />
    ${pocket}
    <rect x="95" y="293" width="110" height="7" fill="#00000014" />
  </svg>`;
}
