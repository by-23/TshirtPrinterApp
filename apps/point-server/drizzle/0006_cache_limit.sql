ALTER TABLE `catalog_scrape_config` ADD `cache_limit_mb` integer DEFAULT 1024 NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_scrape_config` ADD `cache_fill_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_scrape_config` ADD `cache_fill_batch_size` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_scrape_config` ADD `cache_fill_interval_sec` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `designs` ADD `content_hash` text;