ALTER TABLE `catalog_scrape_config` ADD `giphy_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_scrape_config` ADD `cleanpng_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `designs` ADD `source` text;