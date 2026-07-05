CREATE TABLE `designs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
