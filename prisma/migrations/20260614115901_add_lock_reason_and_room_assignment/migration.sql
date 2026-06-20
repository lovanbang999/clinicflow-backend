-- AlterTable
ALTER TABLE `doctor_profiles` ADD COLUMN `roomId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `lockReason` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `doctor_profiles_roomId_idx` ON `doctor_profiles`(`roomId`);

-- AddForeignKey
ALTER TABLE `doctor_profiles` ADD CONSTRAINT `doctor_profiles_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
