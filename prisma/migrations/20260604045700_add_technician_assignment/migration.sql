-- CreateTable
CREATE TABLE `technician_specializations` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `technician_specializations_userId_idx`(`userId`),
    INDEX `technician_specializations_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `technician_specializations_userId_categoryId_key`(`userId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `lab_orders` ADD COLUMN `assignedTechnicianId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `lab_orders_assignedTechnicianId_idx` ON `lab_orders`(`assignedTechnicianId`);

-- AddForeignKey
ALTER TABLE `technician_specializations` ADD CONSTRAINT `technician_specializations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `technician_specializations` ADD CONSTRAINT `technician_specializations_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_orders` ADD CONSTRAINT `lab_orders_assignedTechnicianId_fkey` FOREIGN KEY (`assignedTechnicianId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
