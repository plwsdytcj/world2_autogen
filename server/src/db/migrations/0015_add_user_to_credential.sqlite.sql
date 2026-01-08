-- Add user_id to Credential table for data isolation
-- Users should only see their own API keys

ALTER TABLE "Credential" ADD COLUMN "user_id" TEXT REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "ix_credential_user_id" ON "Credential" ("user_id");

