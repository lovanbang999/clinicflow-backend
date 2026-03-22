/*
  Warnings:

  - A unique constraint covering the columns `[labOrderId]` on the table `invoice_items` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'OPEN';

-- AlterEnum
ALTER TYPE "LabOrderStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "labOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_labOrderId_key" ON "invoice_items"("labOrderId");

-- CreateIndex
CREATE INDEX "invoice_items_serviceId_idx" ON "invoice_items"("serviceId");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
