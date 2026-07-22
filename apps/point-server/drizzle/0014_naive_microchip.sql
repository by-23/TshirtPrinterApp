CREATE TABLE `catalog_manual_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `designs` ADD `central_design_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `designs_central_design_id_unique` ON `designs` (`central_design_id`);