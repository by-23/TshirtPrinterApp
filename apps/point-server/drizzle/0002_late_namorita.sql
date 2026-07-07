CREATE TABLE `catalog_scrape_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`min_resolution_enabled` integer DEFAULT false NOT NULL,
	`min_resolution_px` integer DEFAULT 1000 NOT NULL,
	`page_size` integer DEFAULT 12 NOT NULL,
	`buffer_size` integer DEFAULT 12 NOT NULL,
	`request_delay_ms` integer DEFAULT 1500 NOT NULL,
	`max_requests_per_hour` integer DEFAULT 60 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_scrape_state` (
	`category` text PRIMARY KEY NOT NULL,
	`query_variant_index` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`last_run_at` text,
	`last_error` text,
	`last_downloaded_count` integer DEFAULT 0 NOT NULL,
	`total_downloaded` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `designs` ADD `source_pin_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `designs_source_pin_id_unique` ON `designs` (`source_pin_id`);