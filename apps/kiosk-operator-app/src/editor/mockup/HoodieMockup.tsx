import { bodyPolygonPoints, collarPath, MOCKUP_VIEW_BOX, type GarmentMockupProps } from "./garmentShape.js";

export function HoodieMockup({ color, side, className }: GarmentMockupProps) {
  return (
    <svg viewBox={MOCKUP_VIEW_BOX} className={className} aria-hidden>
      <path
        d="M90,45 Q150,-15 210,45 Q190,65 150,58 Q110,65 90,45 Z"
        fill={color}
        stroke="#00000022"
        strokeWidth={2}
      />
      <polygon points={bodyPolygonPoints(side)} fill={color} stroke="#00000022" strokeWidth={2} />
      <path
        d={collarPath(side)}
        fill="none"
        stroke="#00000033"
        strokeWidth={6}
        strokeLinecap="round"
      />
      {side === "front" && (
        <>
          <rect x={105} y={205} width={90} height={55} rx={12} fill="#00000012" stroke="#00000022" />
          <line x1={140} y1={60} x2={136} y2={92} stroke="#00000055" strokeWidth={3} strokeLinecap="round" />
          <circle cx={136} cy={94} r={3} fill="#00000055" />
          <line x1={160} y1={60} x2={164} y2={92} stroke="#00000055" strokeWidth={3} strokeLinecap="round" />
          <circle cx={164} cy={94} r={3} fill="#00000055" />
        </>
      )}
      <rect x={95} y={293} width={110} height={7} fill="#00000014" />
    </svg>
  );
}
