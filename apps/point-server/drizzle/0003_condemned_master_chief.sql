CREATE TABLE `catalog_scrape_query_tags` (
	`category` text PRIMARY KEY NOT NULL,
	`tags_json` text NOT NULL,
	`updated_at` text NOT NULL
);
