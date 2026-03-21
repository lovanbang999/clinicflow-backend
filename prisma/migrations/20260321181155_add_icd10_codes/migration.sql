-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_patientProfileId_fkey";

-- DropForeignKey
ALTER TABLE "lab_orders" DROP CONSTRAINT "lab_orders_patientProfileId_fkey";

-- DropForeignKey
ALTER TABLE "medical_records" DROP CONSTRAINT "medical_records_patientProfileId_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_patientProfileId_fkey";

-- AlterTable
ALTER TABLE "rooms" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "icd10_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "icd10_codes_code_key" ON "icd10_codes"("code");

-- CreateIndex
CREATE INDEX "icd10_codes_code_idx" ON "icd10_codes"("code");

-- CreateIndex
CREATE INDEX "icd10_codes_name_idx" ON "icd10_codes"("name");
