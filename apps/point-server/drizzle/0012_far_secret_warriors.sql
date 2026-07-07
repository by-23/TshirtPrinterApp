-- Default only cushions upgrading an existing populated DB (pre-hybrid-stylization,
-- e.g. an older gta/anime/noir catalog) so this ALTER doesn't fail on SQLite's
-- NOT NULL-without-DEFAULT restriction — schema.ts intentionally has no
-- `.default()` since every style is meant to always specify its own engineKey
-- explicitly (see `defaultStyles.ts`/the "ИИ-стили" admin panel).
ALTER TABLE `ai_styles` ADD `engine_key` text NOT NULL DEFAULT 'filter:noir';