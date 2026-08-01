import { backfillCatalogThumbs } from "../apps/point-server/src/modules/catalog-scraper/thumbs.ts";

const r = await backfillCatalogThumbs();
console.log(r);
