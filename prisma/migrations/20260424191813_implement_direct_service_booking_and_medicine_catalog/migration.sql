/*
  Warnings:

  - The values [LAB] on the enum `invoices_invoiceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `bookingMode` ENUM('CONSULTATION_FIRST', 'DIRECT_SERVICE') NOT NULL DEFAULT 'CONSULTATION_FIRST';

-- AlterTable
ALTER TABLE `invoices` MODIFY `invoiceType` ENUM('CONSULTATION', 'SERVICE', 'PHARMACY') NOT NULL DEFAULT 'CONSULTATION';

-- AlterTable
ALTER TABLE `prescription_items` ADD COLUMN `medicineId` VARCHAR(191) NULL,
    ADD COLUMN `unitPrice` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `visit_service_orders` ADD COLUMN `estimatedWaitAt` DATETIME(3) NULL,
    ADD COLUMN `roomId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `medicines` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `genericName` VARCHAR(191) NOT NULL,
    `brandName` VARCHAR(191) NULL,
    `concentration` VARCHAR(191) NULL,
    `dosageForm` VARCHAR(191) NULL,
    `defaultUnit` VARCHAR(191) NOT NULL DEFAULT 'viên',
    `defaultPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `stockQuantity` INTEGER NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicines_code_key`(`code`),
    INDEX `medicines_genericName_idx`(`genericName`),
    INDEX `medicines_code_idx`(`code`),
    INDEX `medicines_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `prescription_items_medicineId_fkey` ON `prescription_items`(`medicineId`);

-- CreateIndex
CREATE INDEX `visit_service_orders_roomId_fkey` ON `visit_service_orders`(`roomId`);

-- AddForeignKey
ALTER TABLE `visit_service_orders` ADD CONSTRAINT `visit_service_orders_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `medicines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
