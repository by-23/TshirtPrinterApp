CREATE TABLE `ai_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openai_api_key` text,
	`gemini_api_key` text,
	`updated_at` text NOT NULL
);
