CREATE TABLE `sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `designs` ADD `central_id` text;--> statement-breakpoint
ALTER TABLE `designs` ADD `central_image_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `designs_central_id_unique` ON `designs` (`central_id`);--> statement-breakpoint
ALTER TABLE `point_config` ADD `price_config_json` text;