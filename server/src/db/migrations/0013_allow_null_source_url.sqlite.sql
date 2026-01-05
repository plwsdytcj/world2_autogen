-- SQLite doesn't support ALTER COLUMN, need to recreate table
-- For SQLite, we'll create a new table and migrate data

-- Create new table without NOT NULL constraint on source_url
CREATE TABLE "LorebookEntry_new" (
    id UUID PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    keywords TEXT NOT NULL,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES "Project"(id) ON DELETE CASCADE
);

-- Copy data
INSERT INTO "LorebookEntry_new" SELECT * FROM "LorebookEntry";

-- Drop old table
DROP TABLE "LorebookEntry";

-- Rename new table
ALTER TABLE "LorebookEntry_new" RENAME TO "LorebookEntry";

