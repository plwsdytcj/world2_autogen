-- Single migration for Postgres: add avatar_url to CharacterCard and all_image_url to ProjectSource

ALTER TABLE "CharacterCard" ADD COLUMN "avatar_url" TEXT;

ALTER TABLE "ProjectSource" ADD COLUMN "all_image_url" TEXT[];

