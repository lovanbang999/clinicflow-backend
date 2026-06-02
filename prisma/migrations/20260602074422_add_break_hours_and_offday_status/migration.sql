-- AlterTable
ALTER TABLE `doctor_off_days` ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `doctor_working_hours` ADD COLUMN `breakEndTime` VARCHAR(191) NULL,
    ADD COLUMN `breakStartTime` VARCHAR(191) NULL;
