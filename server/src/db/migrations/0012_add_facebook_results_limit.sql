-- Add facebook_results_limit column to ProjectSource table
ALTER TABLE "ProjectSource" ADD COLUMN IF NOT EXISTS facebook_results_limit INTEGER DEFAULT 20;

