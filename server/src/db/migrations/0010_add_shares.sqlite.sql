-- Share table for deep link exports (SQLite)
CREATE TABLE "Share" (
    "id" TEXT PRIMARY KEY,
    "content_type" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "export_format" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 3,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE INDEX "ix_share_project_id" ON "Share" ("project_id");

