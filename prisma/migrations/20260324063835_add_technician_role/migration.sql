-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TECHNICIAN';

-- AlterTable
ALTER TABLE "lab_orders" ADD COLUMN     "serviceId" TEXT;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
