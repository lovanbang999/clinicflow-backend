-- AlterTable
ALTER TABLE `medicines` ADD COLUMN `country` VARCHAR(191) NULL,
    ADD COLUMN `image_path` VARCHAR(191) NULL,
    ADD COLUMN `image_url` VARCHAR(512) NULL,
    ADD COLUMN `ingredients` TEXT NULL,
    ADD COLUMN `manufacturer_brand` VARCHAR(191) NULL,
    ADD COLUMN `registration_number` VARCHAR(191) NULL,
    ADD COLUMN `side_effects` TEXT NULL,
    ADD COLUMN `source_site` VARCHAR(191) NULL,
    ADD COLUMN `source_url` VARCHAR(512) NULL,
    ADD COLUMN `usage` TEXT NULL,
    ADD COLUMN `uses` TEXT NULL,
    ADD COLUMN `warnings` TEXT NULL,
    MODIFY `notes` TEXT NULL;
