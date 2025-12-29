-- Single migration for SQLite: add avatar_url to CharacterCard and all_image_url to ProjectSource

ALTER TABLE "CharacterCard" ADD COLUMN "avatar_url" TEXT;

ALTER TABLE "ProjectSource" ADD COLUMN "all_image_url" TEXT CHECK(all_image_url IS NULL OR json_valid(all_image_url));

