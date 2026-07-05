import { db } from "../../db/client.js";
import { designs } from "../../db/schema.js";

/**
 * Placeholder catalog for the gallery categories (Stage 3). No real artwork
 * yet — `imageUrl: ""` makes the kiosk gallery fall back to the same
 * icon+title placeholder card used by `CategoryGrid` for categories without
 * an image override. Real images arrive later via the admin panel (Stage 6).
 */
const GALLERY_CATEGORIES = ["memes", "anime_movies", "games"] as const;

const TITLES: Record<(typeof GALLERY_CATEGORIES)[number], string[]> = {
  memes: [
    "Классический мем",
    "Мем с котом",
    "Мем-цитата",
    "Мем-реакция",
    "Мем дня",
    "Топовый мем",
  ],
  anime_movies: [
    "Герой аниме",
    "Культовый кадр",
    "Постер фильма",
    "Ретро-афиша",
    "Цитата из фильма",
    "Аниме-арт",
  ],
  games: [
    "Персонаж игры",
    "Ретро-консоль",
    "Пиксель-арт",
    "Игровой логотип",
    "Игровая сцена",
    "Топовая игра",
  ],
};

async function seed() {
  const existing = await db.select().from(designs);
  if (existing.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Catalog already has ${existing.length} designs, skipping seed`);
    return;
  }

  for (const category of GALLERY_CATEGORIES) {
    for (const title of TITLES[category]) {
      await db.insert(designs).values({ category, title, imageUrl: "", isFeatured: false });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Catalog seeded");
}

await seed();
