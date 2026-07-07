DROP INDEX `designs_central_id_unique`;--> statement-breakpoint
ALTER TABLE `designs` DROP COLUMN `central_id`;--> statement-breakpoint
ALTER TABLE `designs` DROP COLUMN `central_image_url`;