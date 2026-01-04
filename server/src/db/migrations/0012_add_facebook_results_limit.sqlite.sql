-- Add facebook_results_limit column to ProjectSource table (SQLite)
ALTER TABLE "ProjectSource" ADD COLUMN facebook_results_limit INTEGER DEFAULT 20;

