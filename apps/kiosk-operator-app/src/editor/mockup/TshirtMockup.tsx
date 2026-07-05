import { bodyPolygonPoints, collarPath, MOCKUP_VIEW_BOX, type GarmentMockupProps } from "./garmentShape.js";

export function TshirtMockup({ color, side, className }: GarmentMockupProps) {
  return (
    <svg viewBox={MOCKUP_VIEW_BOX} className={className} aria-hidden>
      <polygon points={bodyPolygonPoints(side)} fill={color} stroke="#00000022" strokeWidth={2} />
      <path
        d={collarPath(side)}
        fill="none"
        stroke="#00000033"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <rect x={95} y={293} width={110} height={7} fill="#00000014" />
    </svg>
  );
}
