-- Share table for deep link exports (Postgres)
CREATE TABLE "Share" (
    "id" TEXT PRIMARY KEY,
    "content_type" TEXT NOT NULL,
    "project_id" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
    "export_format" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 3,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ix_share_project_id" ON "Share" ("project_id");

