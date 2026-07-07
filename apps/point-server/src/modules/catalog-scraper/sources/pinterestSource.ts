import { pinDlSearch } from "../pinDl.js";
import type { ScraperSource } from "./types.js";

/** The original (and, until Этап 3's "Несколько источников", only) source — see docs/PLAN.md for the Pinterest scraping risk notes. */
export const pinterestSource: ScraperSource = {
  id: "pinterest",
  label: "Pinterest",
  async search({ query, outputDir, limit, delayMs, minResolutionPx }) {
    const pins = await pinDlSearch({ query, outputDir, limit, delayMs, minResolutionPx });
    return pins.map((pin) => ({ externalId: pin.pinId, filePath: pin.filePath, alt: pin.alt }));
  },
};
