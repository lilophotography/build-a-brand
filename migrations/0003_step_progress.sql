-- Per-V step-by-step progress tracking.
-- Lets the V page (and dashboard cards) show {videos_watched, workbook_downloaded_at,
-- chat_started_at, summary_saved_at} per (user, tool) — finer than the boolean
-- `completed` flag.
--
-- Stored as JSON so the shape can evolve without a schema change.
-- Defaults to '{}' so existing rows continue to work; the V page treats absent
-- keys as "not done yet."

ALTER TABLE brand_progress ADD COLUMN step_progress TEXT NOT NULL DEFAULT '{}';
