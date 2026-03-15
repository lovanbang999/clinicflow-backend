/*
  Warnings:

  - You are about to drop the column `date` on the `doctor_break_times` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `doctor_off_days` table. All the data in the column will be lost.
  - You are about to alter the column `rating` on the `doctor_profiles` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(3,2)`.
  - A unique constraint covering the columns `[doctorId,offDate]` on the table `doctor_off_days` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `doctorId` to the `booking_queue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `queueDate` to the `booking_queue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `breakDate` to the `doctor_break_times` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offDate` to the `doctor_off_days` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'INSURANCE', 'CARD');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_REMINDER', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'LAB_RESULT_READY', 'INVOICE_ISSUED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'SMS', 'IN_APP');

-- DropIndex
DROP INDEX "booking_queue_bookingId_idx";

-- DropIndex
DROP INDEX "booking_queue_queuePosition_idx";

-- DropIndex
DROP INDEX "doctor_break_times_doctorId_date_idx";

-- DropIndex
DROP INDEX "doctor_off_days_doctorId_date_key";

-- AlterTable
ALTER TABLE "booking_queue" ADD COLUMN     "calledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "doctorId" TEXT NOT NULL,
ADD COLUMN     "queueDate" DATE NOT NULL,
ALTER COLUMN "estimatedWaitMinutes" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "booking_status_history" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "bookedBy" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledBy" TEXT;

-- AlterTable
ALTER TABLE "doctor_break_times" DROP COLUMN "date",
ADD COLUMN     "breakDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "doctor_off_days" DROP COLUMN "date",
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "offDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "doctor_profiles" ADD COLUMN     "consultationFee" DECIMAL(12,2),
ALTER COLUMN "rating" SET DATA TYPE DECIMAL(3,2);

-- AlterTable
ALTER TABLE "doctor_schedule_slots" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "doctor_working_hours" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "deviceInfo" TEXT,
ADD COLUMN     "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "category" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "verification_codes" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "patient_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bloodType" TEXT,
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,1),
    "insuranceNumber" TEXT,
    "insuranceProvider" TEXT,
    "insuranceExpiry" DATE,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "familyHistory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "chiefComplaint" TEXT,
    "clinicalFindings" TEXT,
    "diagnosisCode" TEXT,
    "diagnosisName" TEXT,
    "treatmentPlan" TEXT,
    "doctorNotes" TEXT,
    "followUpDate" DATE,
    "followUpNote" TEXT,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "notes" TEXT,
    "isPrinted" BOOLEAN NOT NULL DEFAULT false,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'viên',
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testDescription" TEXT,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'PENDING',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "resultText" TEXT,
    "resultFileUrl" TEXT,
    "isAbnormal" BOOLEAN,
    "abnormalNote" TEXT,
    "recordedBy" TEXT NOT NULL,
    "resultDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "itemName" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "insuranceCovered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "patientPaid" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "insuranceNumber" TEXT,
    "transactionRef" TEXT,
    "confirmedBy" TEXT NOT NULL,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_userId_key" ON "patient_profiles"("userId");

-- CreateIndex
CREATE INDEX "patient_profiles_userId_idx" ON "patient_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_bookingId_key" ON "medical_records"("bookingId");

-- CreateIndex
CREATE INDEX "medical_records_patientId_createdAt_idx" ON "medical_records"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "medical_records_doctorId_idx" ON "medical_records"("doctorId");

-- CreateIndex
CREATE INDEX "medical_records_bookingId_idx" ON "medical_records"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_medicalRecordId_key" ON "prescriptions"("medicalRecordId");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_idx" ON "prescriptions"("patientId");

-- CreateIndex
CREATE INDEX "prescriptions_medicalRecordId_idx" ON "prescriptions"("medicalRecordId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE INDEX "lab_orders_patientId_idx" ON "lab_orders"("patientId");

-- CreateIndex
CREATE INDEX "lab_orders_medicalRecordId_idx" ON "lab_orders"("medicalRecordId");

-- CreateIndex
CREATE INDEX "lab_orders_status_idx" ON "lab_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lab_results_labOrderId_key" ON "lab_results"("labOrderId");

-- CreateIndex
CREATE INDEX "lab_results_labOrderId_idx" ON "lab_results"("labOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_bookingId_key" ON "invoices"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_patientId_idx" ON "invoices"("patientId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_paidAt_idx" ON "invoices"("paidAt");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "booking_queue_doctorId_queueDate_idx" ON "booking_queue"("doctorId", "queueDate");

-- CreateIndex
CREATE INDEX "booking_queue_doctorId_queueDate_queuePosition_idx" ON "booking_queue"("doctorId", "queueDate", "queuePosition");

-- CreateIndex
CREATE INDEX "bookings_doctorId_bookingDate_status_idx" ON "bookings"("doctorId", "bookingDate", "status");

-- CreateIndex
CREATE INDEX "doctor_break_times_doctorId_breakDate_idx" ON "doctor_break_times"("doctorId", "breakDate");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_off_days_doctorId_offDate_key" ON "doctor_off_days"("doctorId", "offDate");

-- CreateIndex
CREATE INDEX "services_category_idx" ON "services"("category");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "doctor_off_days" ADD CONSTRAINT "doctor_off_days_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookedBy_fkey" FOREIGN KEY ("bookedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
