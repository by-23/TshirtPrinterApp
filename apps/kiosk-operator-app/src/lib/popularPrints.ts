import { useEffect, useState } from "react";
import type { Design } from "@tshirt/shared-types";
import { fetchPopularDesigns, resolveDesignImageUrl } from "./pointServer.js";
import { PRINT_CATALOG, printImageKey } from "./printCatalog.js";

/** How often the home banner re-polls point-server for fresh usage stats (kiosk sits idle between orders). */
const POPULAR_POLL_MS = 45_000;

/** Normalized shape `Banner.tsx`/`PopularPrintSlide.tsx` render — hides whether a slide came from real catalog usage stats or the local fallback assets. */
export interface BannerSlide {
  id: string;
  imageUrl: string;
  shirt: "white" | "black";
  heartLabel: string;
  /** Only set for local fallback prints — lets the slide pick up an operator image override via `kioskImages`. */
  overrideKey?: string;
}

function fromDesign(design: Design, index: number): BannerSlide {
  return {
    id: `design-${design.id}`,
    imageUrl: resolveDesignImageUrl(design.imageUrl),
    shirt: index % 2 === 0 ? "white" : "black",
    heartLabel: String(design.useCount),
  };
}

function fromStaticCatalog(): BannerSlide[] {
  return PRINT_CATALOG.map((print) => ({
    id: `static-${print.id}`,
    imageUrl: print.url,
    shirt: print.shirt,
    heartLabel: print.likes,
    overrideKey: printImageKey(print.id),
  }));
}

/**
 * Home page "Популярные принты" banner data: highest use-count designs
 * across every category (server-capped per category, see
 * `selectPopularDesigns` in point-server), falling back to the local
 * `src/assets/prints/` catalog while the real catalog has no usage stats
 * yet (fresh install, nobody has printed anything) or point-server is
 * unreachable (fail-open).
 */
export function usePopularPrintSlides(): BannerSlide[] {
  const [designs, setDesigns] = useState<Design[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetchPopularDesigns()
        .then((page) => {
          if (!cancelled) setDesigns(page);
        })
        .catch(() => {
          // point-server unreachable — keep whatever we had (fail-open).
        });
    }

    load();
    const timer = setInterval(load, POPULAR_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (designs && designs.length > 0) {
    return designs.map(fromDesign);
  }
  return fromStaticCatalog();
}
