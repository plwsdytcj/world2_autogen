-- Add user_id to GlobalTemplate table for data isolation
-- Users should only see their own templates

ALTER TABLE "GlobalTemplate" ADD COLUMN "user_id" TEXT REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "ix_globaltemplate_user_id" ON "GlobalTemplate" ("user_id");

