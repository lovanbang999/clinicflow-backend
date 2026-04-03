-- AlterTable
ALTER TABLE "prescription_items" ADD COLUMN     "visitServiceOrderId" TEXT;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_visitServiceOrderId_fkey" FOREIGN KEY ("visitServiceOrderId") REFERENCES "visit_service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
