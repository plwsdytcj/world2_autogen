-- Allow NULL for source_url in LorebookEntry table
ALTER TABLE "LorebookEntry" ALTER COLUMN source_url DROP NOT NULL;

