-- AlterTable
ALTER TABLE `lab_orders` ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `suggestedOrder` INTEGER NULL;

-- AlterTable
ALTER TABLE `visit_service_orders` ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `suggestedOrder` INTEGER NULL;
