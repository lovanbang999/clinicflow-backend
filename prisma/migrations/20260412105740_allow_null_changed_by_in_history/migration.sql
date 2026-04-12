-- DropForeignKey
ALTER TABLE `booking_status_history` DROP FOREIGN KEY `booking_status_history_changedById_fkey`;

-- AlterTable
ALTER TABLE `booking_status_history` MODIFY `changedById` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
