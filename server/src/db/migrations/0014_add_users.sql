-- User table for authentication (PostgreSQL)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "google_id" TEXT UNIQUE,
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_user_google_id" ON "User" ("google_id");
CREATE INDEX IF NOT EXISTS "ix_user_email" ON "User" ("email");

-- Session table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "refresh_token" TEXT UNIQUE NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_session_user_id" ON "Session" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_session_refresh_token" ON "Session" ("refresh_token");

-- Add user_id to Project table
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "user_id" TEXT REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "ix_project_user_id" ON "Project" ("user_id");

-- Trigger for User updated_at
CREATE OR REPLACE FUNCTION update_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_updated_at ON "User";
CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_user_updated_at();

