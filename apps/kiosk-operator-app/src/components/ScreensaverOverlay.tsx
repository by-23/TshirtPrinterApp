import { useEffect, useRef, useState } from "react";
import type { ScreensaverVideo } from "../lib/screensaverVideos.js";

interface ScreensaverOverlayProps {
  videos: ScreensaverVideo[];
  onDismiss: () => void;
}

/**
 * Full-screen attract loop: plays the playlist in filename order, wrapping
 * forever until the customer taps/clicks anywhere on the overlay.
 */
export function ScreensaverOverlay({ videos, onDismiss }: ScreensaverOverlayProps) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const count = videos.length;
  const current = count > 0 ? videos[index % count] : undefined;

  useEffect(() => {
    setIndex(0);
  }, [videos]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !current || count === 0) return;

    let cancelled = false;
    el.muted = true;

    const skip = () => {
      if (!cancelled) setIndex((prev) => (prev + 1) % count);
    };

    void el.play().catch(skip);

    return () => {
      cancelled = true;
      el.pause();
    };
  }, [current?.url, count]);

  if (!current) return null;

  return (
    <button
      type="button"
      className="kiosk-screensaver"
      aria-label="Коснитесь экрана, чтобы продолжить"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      <video
        key={current.url}
        ref={videoRef}
        className="kiosk-screensaver__video"
        src={current.url}
        playsInline
        muted
        preload="auto"
        onEnded={() => setIndex((prev) => (prev + 1) % count)}
        onError={() => setIndex((prev) => (prev + 1) % count)}
      />
    </button>
  );
}
