CREATE TABLE `operators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operators_login_unique` ON `operators` (`login`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`garment_type` text NOT NULL,
	`garment_color` text NOT NULL,
	`garment_size` text NOT NULL,
	`garment_fabric` text NOT NULL,
	`side` text NOT NULL,
	`print_size` text NOT NULL,
	`price` real NOT NULL,
	`mockup_image_path` text,
	`design_image_path` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `point_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'closed' NOT NULL,
	`upload_mode` text DEFAULT 'relay' NOT NULL,
	`updated_at` text NOT NULL
);
