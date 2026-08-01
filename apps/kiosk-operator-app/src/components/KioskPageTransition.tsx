import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  usePageTransitionStore,
  type PageTransitionDirection,
  type PageTransitionType,
} from "../lib/pageTransitionStore.js";

type Layer = { key: string; node: ReactNode };

/** Soft-but-snappy dissolve — independent of the global transition duration slider. */
const DISSOLVE_DURATION_MS = 480;

type StackPhase =
  | {
      kind: "idle";
      current: Layer;
      /** Previous screen kept mounted under the current one for a true pop reveal. */
      beneath: Layer | null;
    }
  | {
      kind: "forward";
      type: PageTransitionType;
      under: Layer;
      over: Layer;
    }
  | {
      kind: "back";
      type: PageTransitionType;
      under: Layer;
      over: Layer;
    };

function topKey(phase: StackPhase): string {
  if (phase.kind === "idle") return phase.current.key;
  if (phase.kind === "forward") return phase.over.key;
  return phase.under.key;
}

/**
 * Stack-style page transitions:
 * - forward: new screen enters on top; previous stays mounted only during the animation
 * - idle: only the current screen stays mounted (previous is unmounted — no Swiper/polls)
 * - back: top exits; destination remounts (no parked underlay keep-alive)
 *
 * Pass a frozen route element (e.g. `useOutlet()`), not `<Outlet />`.
 *
 * `dissolve` fades content only (under out → over in), leaving KioskAmbientBackdrop
 * untouched. Other types still get an opaque plate mid-transition so transparent
 * pages don't ghost through each other.
 */
export function KioskPageTransition({
  animKey,
  direction = "forward",
  className = "",
  children,
}: {
  animKey: string;
  direction?: PageTransitionDirection;
  className?: string;
  children: ReactNode;
}) {
  const type = usePageTransitionStore((state) => state.type);
  const durationMs = usePageTransitionStore((state) => state.durationMs);

  const directionRef = useRef(direction);
  directionRef.current = direction;

  const [phase, setPhase] = useState<StackPhase>({
    kind: "idle",
    current: { key: animKey, node: children },
    beneath: null,
  });

  // Keep the live route node fresh on the active layer.
  useLayoutEffect(() => {
    setPhase((prev) => {
      if (prev.kind === "idle" && prev.current.key === animKey) {
        return { ...prev, current: { key: animKey, node: children } };
      }
      if (prev.kind === "forward" && prev.over.key === animKey) {
        return { ...prev, over: { key: animKey, node: children } };
      }
      if (prev.kind === "back" && prev.under.key === animKey) {
        return { ...prev, under: { key: animKey, node: children } };
      }
      return prev;
    });
  }, [animKey, children]);

  useLayoutEffect(() => {
    setPhase((prev) => {
      if (animKey === topKey(prev)) return prev;

      const next: Layer = { key: animKey, node: children };
      const dir = directionRef.current;

      if (type === "none") {
        return { kind: "idle", current: next, beneath: null };
      }

      if (dir === "back") {
        const leaving =
          prev.kind === "idle"
            ? prev.current
            : prev.kind === "forward"
              ? prev.over
              : prev.over;

        // Prefer the kept-alive underlay when it matches the destination.
        const kept =
          prev.kind === "idle" && prev.beneath?.key === next.key
            ? prev.beneath
            : prev.kind === "forward" && prev.under.key === next.key
              ? prev.under
              : prev.kind === "back" && prev.under.key === next.key
                ? prev.under
                : next;

        return {
          kind: "back",
          type,
          under: kept,
          over: leaving,
        };
      }

      // forward
      const under =
        prev.kind === "idle"
          ? prev.current
          : prev.kind === "forward"
            ? prev.over
            : prev.under;

      return {
        kind: "forward",
        type,
        under,
        over: next,
      };
    });
  }, [animKey, children, type]);

  const style = {
    "--kiosk-page-duration": `${durationMs}ms`,
    // Dissolve keeps its own snappy timing — global slider is for heavier transitions.
    "--kiosk-dissolve-duration": `${DISSOLVE_DURATION_MS}ms`,
  } as CSSProperties;
  const animatingOverKey = phase.kind === "idle" ? null : phase.over.key;
  const isDissolve = phase.kind !== "idle" && phase.type === "dissolve";
  const activeDurationMs = isDissolve ? DISSOLVE_DURATION_MS : durationMs;
  const stackClass = [
    "kiosk-page-stack",
    phase.kind !== "idle" ? "kiosk-page-stack--animating" : "",
    isDissolve ? "kiosk-page-stack--dissolve" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function finish() {
    setPhase((prev) => {
      if (prev.kind === "forward") {
        // Do not keep the previous route mounted — Swiper/polls/images would
        // keep running under a parked layer on weak Android kiosk panels.
        return { kind: "idle", current: prev.over, beneath: null };
      }
      if (prev.kind === "back") {
        return { kind: "idle", current: prev.under, beneath: null };
      }
      return prev;
    });
  }

  // Fallback if `animationend` never fires (interrupted CSS, reduced-motion edge cases).
  useEffect(() => {
    if (!animatingOverKey) return;
    const timer = window.setTimeout(finish, activeDurationMs + 80);
    return () => window.clearTimeout(timer);
  }, [animatingOverKey, activeDurationMs]);

  if (phase.kind === "idle") {
    return (
      <div className={stackClass} style={style}>
        {phase.beneath ? (
          <div
            key={phase.beneath.key}
            className="kiosk-page kiosk-page--under kiosk-page--parked"
            aria-hidden
          >
            {phase.beneath.node}
          </div>
        ) : null}
        <div key={phase.current.key} className="kiosk-page kiosk-page--over">
          {phase.current.node}
        </div>
      </div>
    );
  }

  const overClass =
    phase.kind === "forward"
      ? `kiosk-page kiosk-page--over kiosk-page--enter-${phase.type}`
      : `kiosk-page kiosk-page--over kiosk-page--exit-${phase.type}`;

  // Dissolve animates both layers: old content out, new content in (ambient stays put).
  const underClass =
    phase.type === "dissolve"
      ? phase.kind === "forward"
        ? "kiosk-page kiosk-page--under kiosk-page--exit-dissolve"
        : "kiosk-page kiosk-page--under kiosk-page--enter-dissolve"
      : "kiosk-page kiosk-page--under";

  return (
    <div className={stackClass} style={style}>
      <div key={phase.under.key} className={underClass} aria-hidden>
        {phase.under.node}
      </div>
      <div
        key={phase.over.key}
        className={overClass}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          finish();
        }}
      >
        {phase.over.node}
      </div>
    </div>
  );
}
