/**
 * Optional bundled fallback: drop MP4 / WebM / OGG into `src/assets/screensaver/`
 * for offline demos. Production playlist comes from point-server
 * (`GET /ads/videos`, uploaded via operator «Реклама»).
 *
 * Naming for bundled files:
 * - `01-summer-promo.mp4` → plays first (sorted by filename)
 */

import { useEffect, useState } from "react";
import { fetchAdsVideos, resolveDesignImageUrl } from "./pointServer.js";

const SCREENSAVER_VIDEO_GLOB = import.meta.glob("../assets/screensaver/*.{mp4,webm,ogg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export interface ScreensaverVideo {
  id: string;
  url: string;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function videoIdFromPath(path: string): string {
  return basename(path).replace(/\.(mp4|webm|ogg)$/i, "");
}

function buildBundledPlaylist(): ScreensaverVideo[] {
  return Object.entries(SCREENSAVER_VIDEO_GLOB)
    .map(([path, url]) => ({ id: videoIdFromPath(path), url }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Bundled attract-loop videos — used only when the point has no uploaded ads. */
export const BUNDLED_SCREENSAVER_PLAYLIST: ScreensaverVideo[] = buildBundledPlaylist();

/** How long the kiosk must sit untouched before the attract loop starts. */
export const SCREENSAVER_IDLE_MS = import.meta.env.DEV ? 15_000 : 60_000;

/** How often the kiosk re-fetches the operator-uploaded playlist. */
const PLAYLIST_POLL_MS = 20_000;

/**
 * Live playlist for the attract loop: point-server ads first, bundled folder
 * as offline/demo fallback. Empty → screensaver stays off.
 */
export function useScreensaverPlaylist(): ScreensaverVideo[] {
  const [playlist, setPlaylist] = useState<ScreensaverVideo[]>(BUNDLED_SCREENSAVER_PLAYLIST);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const videos = await fetchAdsVideos();
        if (cancelled) return;
        if (videos.length > 0) {
          setPlaylist(
            videos.map((video) => ({
              id: `ads-${video.id}`,
              url: resolveDesignImageUrl(video.fileUrl),
            })),
          );
        } else {
          setPlaylist(BUNDLED_SCREENSAVER_PLAYLIST);
        }
      } catch {
        // Fail-open: keep bundled / last successful playlist.
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), PLAYLIST_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return playlist;
}
