CREATE TABLE `managed_fonts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`family` text NOT NULL,
	`kind` text NOT NULL,
	`google_family` text,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`local_file_url` text,
	`format` text,
	`updated_at` text NOT NULL
);
