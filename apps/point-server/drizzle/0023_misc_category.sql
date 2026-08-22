UPDATE `designs` SET `category` = 'misc' WHERE `category` = 'memes';--> statement-breakpoint
UPDATE `designs` SET `image_url` = REPLACE(`image_url`, '/files/catalog/memes/', '/files/catalog/misc/') WHERE `image_url` LIKE '%/files/catalog/memes/%';--> statement-breakpoint
DELETE FROM `catalog_scrape_query_tags` WHERE `category` = 'memes' AND EXISTS (SELECT 1 FROM `catalog_scrape_query_tags` WHERE `category` = 'misc');--> statement-breakpoint
UPDATE `catalog_scrape_query_tags` SET `category` = 'misc' WHERE `category` = 'memes';--> statement-breakpoint
UPDATE `catalog_scrape_query_tags` SET `tags_json` = '["стикер png","наклейка png","clipart png","sticker png","иллюстрация png","illustration png"]' WHERE `category` = 'misc';--> statement-breakpoint
DELETE FROM `catalog_scrape_state` WHERE `category` = 'memes' AND EXISTS (SELECT 1 FROM `catalog_scrape_state` WHERE `category` = 'misc');--> statement-breakpoint
UPDATE `catalog_scrape_state` SET `category` = 'misc' WHERE `category` = 'memes';
