ALTER TABLE `orders` ADD `dtf_print_image_path` text;--> statement-breakpoint
CREATE TABLE `printer_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_json` text NOT NULL,
	`updated_at` text NOT NULL
);
