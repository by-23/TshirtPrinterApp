import { isNull, or, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { designs } from "../../db/schema.js";

/**
 * The gallery categories (memes/anime_movies/games) used to ship with 18
 * placeholder rows (title only, no image — see git history). Real artwork
 * now arrives automatically via the Pinterest catalog scraper (Этап 3,
 * `modules/catalog-scraper`), which fills the categories on point-server
 * startup. This script just removes any leftover placeholder rows from
 * older installs so they don't clutter the gallery with icon-only cards.
 */
async function cleanupPlaceholders() {
  const removed = await db
    .delete(designs)
    .where(or(isNull(designs.imageUrl), eq(designs.imageUrl, "")))
    .returning();

  if (removed.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Removed ${removed.length} placeholder design(s) without an image`);
  } else {
    // eslint-disable-next-line no-console
    console.log("No placeholder designs to remove — catalog scraper fills the gallery on startup");
  }
}

await cleanupPlaceholders();
