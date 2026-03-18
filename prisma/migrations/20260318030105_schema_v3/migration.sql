/*
  Schema v3.0 Data Migration
  
  Breaking changes handled here:
  - patient_profiles: added fullName (from users), patientCode (generated), isGuest, phone, email, gender, dateOfBirth, address
  - bookings: dropped patientId (FK→users), added patientProfileId (FK→patient_profiles), bookingCode
  - Similar changes to invoices, medical_records, lab_orders, prescriptions
  - New: Room model, BookingSource/Priority/ScheduleSlotStatus/RoomType/EInvoiceStatus enums
  - Notifications: userId now nullable, added guestEmail/guestPhone/retryCount fields
  - SystemConfig: added category, isSecret
*/

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "BookingPriority" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ScheduleSlotStatus" AS ENUM ('SCHEDULED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CONSULTATION', 'ULTRASOUND', 'PROCEDURE', 'LAB', 'WAITING');

-- CreateEnum
CREATE TYPE "EInvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_patientId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "patient_profiles" DROP CONSTRAINT "patient_profiles_userId_fkey";

-- DropIndex
DROP INDEX "bookings_patientId_idx";

-- DropIndex
DROP INDEX "invoices_patientId_idx";

-- DropIndex
DROP INDEX "lab_orders_patientId_idx";

-- DropIndex
DROP INDEX "medical_records_patientId_createdAt_idx";

-- DropIndex
DROP INDEX "prescriptions_patientId_idx";

-- ============================================
-- STEP 1: patient_profiles — add new columns as nullable first, backfill, then constrain
-- ============================================

ALTER TABLE "patient_profiles"
  ADD COLUMN "address"           TEXT,
  ADD COLUMN "dateOfBirth"       DATE,
  ADD COLUMN "email"             TEXT,
  ADD COLUMN "ethnicity"         TEXT,
  ADD COLUMN "fullName"          TEXT,            -- nullable during migration
  ADD COLUMN "gender"            "Gender",
  ADD COLUMN "insuranceCardBack" TEXT,
  ADD COLUMN "insuranceCardFront" TEXT,
  ADD COLUMN "insuranceType"     TEXT,
  ADD COLUMN "isGuest"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nationalId"        TEXT,
  ADD COLUMN "occupation"        TEXT,
  ADD COLUMN "patientCode"       TEXT,            -- nullable during migration
  ADD COLUMN "phone"             TEXT,
  ALTER COLUMN "userId" DROP NOT NULL;

-- Backfill fullName, phone, email, gender, dateOfBirth, address from linked users
UPDATE "patient_profiles" pp
SET
  "fullName"    = u."fullName",
  "phone"       = u."phone",
  "email"       = u."email",
  "gender"      = u."gender",
  "dateOfBirth" = u."dateOfBirth",
  "address"     = u."address"
FROM "users" u
WHERE pp."userId" = u."id";

-- Set a placeholder fullName for any orphaned rows (shouldn't exist, but safeguard)
UPDATE "patient_profiles"
SET "fullName" = 'Unknown Patient'
WHERE "fullName" IS NULL;

-- Generate patientCode for existing profiles using row_number
UPDATE "patient_profiles"
SET "patientCode" = 'BN-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-'
  || LPAD(row_num::TEXT, 4, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt") AS row_num
  FROM "patient_profiles"
) numbered
WHERE "patient_profiles"."id" = numbered."id";

-- Now enforce NOT NULL
ALTER TABLE "patient_profiles"
  ALTER COLUMN "fullName" SET NOT NULL,
  ALTER COLUMN "patientCode" SET NOT NULL;

-- ============================================
-- STEP 2: bookings — add patientProfileId and bookingCode as nullable, backfill, constrain
-- ============================================

ALTER TABLE "bookings"
  ADD COLUMN "patientProfileId" TEXT,            -- nullable during migration
  ADD COLUMN "bookingCode"      TEXT,            -- nullable during migration
  ADD COLUMN "checkedInAt"      TIMESTAMP(3),
  ADD COLUMN "confirmedAt"      TIMESTAMP(3),
  ADD COLUMN "priority"         "BookingPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "reminderSentAt"   TIMESTAMP(3),
  ADD COLUMN "source"           "BookingSource" NOT NULL DEFAULT 'ONLINE';

-- Backfill patientProfileId from the old patientId→patient_profiles.userId link
UPDATE "bookings" b
SET "patientProfileId" = pp."id"
FROM "patient_profiles" pp
WHERE pp."userId" = b."patientId";

-- For bookings whose patient has no profile (edge case), create a minimal guest profile
-- Guard: only insert if no profile exists for this userId yet
INSERT INTO "patient_profiles" ("id", "userId", "fullName", "patientCode", "isGuest", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  b."patientId",
  COALESCE(u."fullName", 'Unknown Patient'),
  'BN-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-MIGR-' || ROW_NUMBER() OVER (ORDER BY b."id")::TEXT,
  false,
  NOW(),
  NOW()
FROM "bookings" b
JOIN "users" u ON u."id" = b."patientId"
WHERE b."patientProfileId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "patient_profiles" pp2 WHERE pp2."userId" = b."patientId"
  );

-- Re-run update for any remaining bookings still without patientProfileId
UPDATE "bookings" b
SET "patientProfileId" = pp."id"
FROM "patient_profiles" pp
WHERE pp."userId" = b."patientId"
  AND b."patientProfileId" IS NULL;

-- Generate bookingCode for existing rows
UPDATE "bookings"
SET "bookingCode" = 'BK-MIGRATED-' || LPAD(row_num::TEXT, 4, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt") AS row_num
  FROM "bookings"
) numbered
WHERE "bookings"."id" = numbered."id"
  AND "bookings"."bookingCode" IS NULL;

-- Drop old patientId column
ALTER TABLE "bookings" DROP COLUMN "patientId";

-- Now enforce NOT NULL
ALTER TABLE "bookings"
  ALTER COLUMN "patientProfileId" SET NOT NULL,
  ALTER COLUMN "bookingCode" SET NOT NULL;

-- ============================================
-- STEP 3: invoices, medical_records, lab_orders, prescriptions
--         Replace patientId (FK→users) with patientProfileId (FK→patient_profiles)
-- ============================================

-- invoices
ALTER TABLE "invoices"
  ADD COLUMN "patientProfileId" TEXT,
  ADD COLUMN "einvoiceCode"     TEXT,
  ADD COLUMN "einvoiceIssuedAt" TIMESTAMP(3),
  ADD COLUMN "einvoiceStatus"   "EInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "einvoiceUrl"      TEXT,
  ADD COLUMN "insuranceAmount"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "insuranceClaimed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "patientCoPayment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatAmount"        DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatRate"          DECIMAL(5,2) NOT NULL DEFAULT 0;

UPDATE "invoices" i
SET "patientProfileId" = pp."id"
FROM "patient_profiles" pp
WHERE pp."userId" = i."patientId";

-- For orphaned invoices (if any), resolve via booking
UPDATE "invoices" i
SET "patientProfileId" = b."patientProfileId"
FROM "bookings" b
WHERE i."bookingId" = b."id"
  AND i."patientProfileId" IS NULL;

ALTER TABLE "invoices" DROP COLUMN "patientId";
ALTER TABLE "invoices" ALTER COLUMN "patientProfileId" SET NOT NULL;

-- lab_orders
ALTER TABLE "lab_orders" ADD COLUMN "patientProfileId" TEXT;

UPDATE "lab_orders" lo
SET "patientProfileId" = pp."id"
FROM "patient_profiles" pp
WHERE pp."userId" = lo."patientId";

UPDATE "lab_orders" lo
SET "patientProfileId" = b."patientProfileId"
FROM "bookings" b
WHERE lo."bookingId" = b."id"
  AND lo."patientProfileId" IS NULL;

ALTER TABLE "lab_orders" DROP COLUMN "patientId";
ALTER TABLE "lab_orders" ALTER COLUMN "patientProfileId" SET NOT NULL;

-- medical_records
ALTER TABLE "medical_records" ADD COLUMN "patientProfileId" TEXT;

UPDATE "medical_records" mr
SET "patientProfileId" = pp."id"
FROM "patient_profiles" pp
WHERE pp."userId" = mr."patientId";

UPDATE "medical_records" mr
SET "patientProfileId" = b."patientProfileId"
FROM "bookings" b
WHERE mr."bookingId" = b."id"
  AND mr."patientProfileId" IS NULL;

ALTER TABLE "medical_records" DROP COLUMN "patientId";
ALTER TABLE "medical_records" ALTER COLUMN "patientProfileId" SET NOT NULL;

-- prescriptions
ALTER TABLE "prescriptions" ADD COLUMN "patientProfileId" TEXT;

UPDATE "prescriptions" p
SET "patientProfileId" = mr."patientProfileId"
FROM "medical_records" mr
WHERE p."medicalRecordId" = mr."id";

ALTER TABLE "prescriptions" DROP COLUMN "patientId";
ALTER TABLE "prescriptions" ALTER COLUMN "patientProfileId" SET NOT NULL;

-- ============================================
-- STEP 4: Other table alterations (no data migration needed)
-- ============================================

-- doctor_schedule_slots
ALTER TABLE "doctor_schedule_slots"
  DROP COLUMN "room",
  ADD COLUMN "bookedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "roomId" TEXT,
  DROP COLUMN "status",
  ADD COLUMN "status" "ScheduleSlotStatus" NOT NULL DEFAULT 'SCHEDULED';

-- notifications
ALTER TABLE "notifications"
  ADD COLUMN "guestEmail"   TEXT,
  ADD COLUMN "guestPhone"   TEXT,
  ADD COLUMN "maxRetries"   INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "nextRetryAt"  TIMESTAMP(3),
  ADD COLUMN "provider"     TEXT,
  ADD COLUMN "retryCount"   INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "userId" DROP NOT NULL;

-- system_configs
ALTER TABLE "system_configs"
  ADD COLUMN "category"  TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "isSecret"  BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- STEP 5: Create new Room table
-- ============================================

CREATE TABLE "rooms" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "type"      "RoomType" NOT NULL DEFAULT 'CONSULTATION',
    "floor"     TEXT,
    "capacity"  INTEGER NOT NULL DEFAULT 1,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 6: Create indexes
-- ============================================

CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");
CREATE INDEX "rooms_isActive_idx" ON "rooms"("isActive");
CREATE UNIQUE INDEX "bookings_bookingCode_key" ON "bookings"("bookingCode");
CREATE INDEX "bookings_patientProfileId_idx" ON "bookings"("patientProfileId");
CREATE INDEX "bookings_bookingCode_idx" ON "bookings"("bookingCode");
CREATE INDEX "doctor_schedule_slots_roomId_date_idx" ON "doctor_schedule_slots"("roomId", "date");
CREATE INDEX "invoices_patientProfileId_idx" ON "invoices"("patientProfileId");
CREATE INDEX "invoices_einvoiceStatus_idx" ON "invoices"("einvoiceStatus");
CREATE INDEX "lab_orders_patientProfileId_idx" ON "lab_orders"("patientProfileId");
CREATE INDEX "medical_records_patientProfileId_createdAt_idx" ON "medical_records"("patientProfileId", "createdAt" DESC);
CREATE INDEX "notifications_nextRetryAt_idx" ON "notifications"("nextRetryAt");
CREATE UNIQUE INDEX "patient_profiles_patientCode_key" ON "patient_profiles"("patientCode");
CREATE INDEX "patient_profiles_patientCode_idx" ON "patient_profiles"("patientCode");
CREATE INDEX "patient_profiles_phone_idx" ON "patient_profiles"("phone");
CREATE INDEX "patient_profiles_nationalId_idx" ON "patient_profiles"("nationalId");
CREATE INDEX "prescriptions_patientProfileId_idx" ON "prescriptions"("patientProfileId");
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");

-- ============================================
-- STEP 7: Add foreign keys
-- ============================================

ALTER TABLE "doctor_schedule_slots"
  ADD CONSTRAINT "doctor_schedule_slots_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patient_profiles"
  ADD CONSTRAINT "patient_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lab_orders"
  ADD CONSTRAINT "lab_orders_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medical_records"
  ADD CONSTRAINT "medical_records_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prescriptions"
  ADD CONSTRAINT "prescriptions_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
