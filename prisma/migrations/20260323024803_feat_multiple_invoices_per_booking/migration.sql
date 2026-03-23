-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('CONSULTATION', 'LAB', 'PHARMACY');

-- DropIndex
DROP INDEX "invoices_bookingId_key";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "invoiceType" "InvoiceType" NOT NULL DEFAULT 'CONSULTATION';

-- CreateIndex
CREATE INDEX "invoices_bookingId_idx" ON "invoices"("bookingId");
