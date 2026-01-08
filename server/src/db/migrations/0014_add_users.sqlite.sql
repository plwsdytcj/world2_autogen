-- User table for authentication
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "google_id" TEXT UNIQUE,
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS "ix_user_google_id" ON "User" ("google_id");
CREATE INDEX IF NOT EXISTS "ix_user_email" ON "User" ("email");

-- Session table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT UNIQUE NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_session_user_id" ON "Session" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_session_refresh_token" ON "Session" ("refresh_token");

-- Add user_id to Project table (optional, allows null for backwards compatibility)
ALTER TABLE "Project" ADD COLUMN "user_id" TEXT REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "ix_project_user_id" ON "Project" ("user_id");

-- Trigger for User updated_at
CREATE TRIGGER IF NOT EXISTS update_user_updated_at AFTER UPDATE ON "User"
BEGIN
    UPDATE "User" SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

