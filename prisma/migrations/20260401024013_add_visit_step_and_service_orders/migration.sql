/*
  Warnings:

  - A unique constraint covering the columns `[serviceCode]` on the table `services` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VisitStep" AS ENUM ('SYMPTOMS_TAKEN', 'SERVICES_ORDERED', 'AWAITING_RESULTS', 'RESULTS_READY', 'DIAGNOSED', 'PRESCRIBED', 'COMPLETED');

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "diagnosedAt" TIMESTAMP(3),
ADD COLUMN     "orderedAt" TIMESTAMP(3),
ADD COLUMN     "prescribedAt" TIMESTAMP(3),
ADD COLUMN     "symptomsAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visitStep" "VisitStep" NOT NULL DEFAULT 'SYMPTOMS_TAKEN';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "serviceCode" TEXT;

-- CreateTable
CREATE TABLE "visit_service_orders" (
    "id" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'PENDING',
    "orderedBy" TEXT NOT NULL,
    "performedBy" TEXT,
    "resultText" TEXT,
    "resultFileUrl" TEXT,
    "isAbnormal" BOOLEAN,
    "abnormalNote" TEXT,
    "labOrderId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_service_orders_labOrderId_key" ON "visit_service_orders"("labOrderId");

-- CreateIndex
CREATE INDEX "visit_service_orders_medicalRecordId_idx" ON "visit_service_orders"("medicalRecordId");

-- CreateIndex
CREATE INDEX "visit_service_orders_patientProfileId_idx" ON "visit_service_orders"("patientProfileId");

-- CreateIndex
CREATE INDEX "visit_service_orders_status_idx" ON "visit_service_orders"("status");

-- CreateIndex
CREATE INDEX "visit_service_orders_bookingId_idx" ON "visit_service_orders"("bookingId");

-- CreateIndex
CREATE INDEX "medical_records_visitStep_idx" ON "medical_records"("visitStep");

-- CreateIndex
CREATE UNIQUE INDEX "services_serviceCode_key" ON "services"("serviceCode");

-- CreateIndex
CREATE INDEX "services_serviceCode_idx" ON "services"("serviceCode");

-- AddForeignKey
ALTER TABLE "visit_service_orders" ADD CONSTRAINT "visit_service_orders_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_service_orders" ADD CONSTRAINT "visit_service_orders_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
