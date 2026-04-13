/*
  Warnings:

  - A unique constraint covering the columns `[visitServiceOrderId]` on the table `invoice_items` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `invoice_items` ADD COLUMN `visitServiceOrderId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `invoice_items_visitServiceOrderId_key` ON `invoice_items`(`visitServiceOrderId`);

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_visitServiceOrderId_fkey` FOREIGN KEY (`visitServiceOrderId`) REFERENCES `visit_service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
