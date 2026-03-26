-- Migration: Booking Flow Overhaul
-- Auto-applied via: npx prisma migrate reset / deploy
-- Column names use camelCase (Prisma default, no @map on fields)

-- ============================================
-- 1. doctor_schedule_slots: add capacity tracking fields
-- ============================================
ALTER TABLE "doctor_schedule_slots"
  ADD COLUMN IF NOT EXISTS "maxPreBookings" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "maxQueueSize"   INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "preBookedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "queueCount"     INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 2. bookings: nullable startTime/endTime + new fields
-- ============================================
ALTER TABLE "bookings"
  ALTER COLUMN "startTime" DROP NOT NULL,
  ALTER COLUMN "endTime"   DROP NOT NULL;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "isPreBooked"   BOOLEAN   NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "estimatedTime" TIMESTAMP;

-- Backfill: existing bookings are all pre-bookings
UPDATE "bookings" SET "isPreBooked" = TRUE WHERE "isPreBooked" IS NOT DISTINCT FROM TRUE;

-- ============================================
-- 3. bookings: partial unique index (1 patient + 1 doctor + 1 day = 1 active booking)
-- Uses camelCase column names (Prisma default)
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS "uq_patient_doctor_date_active"
  ON "bookings" ("patientProfileId", "doctorId", "bookingDate")
  WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW');

-- ============================================
-- 4. bookings: new indexes for isPreBooked queries
-- ============================================
CREATE INDEX IF NOT EXISTS "bookings_isPreBooked_idx"
  ON "bookings" ("isPreBooked");

CREATE INDEX IF NOT EXISTS "bookings_doctorId_bookingDate_isPreBooked_idx"
  ON "bookings" ("doctorId", "bookingDate", "isPreBooked");

-- ============================================
-- 5. booking_queue: denormalized fields for priority sort
-- ============================================
ALTER TABLE "booking_queue"
  ADD COLUMN IF NOT EXISTS "isPreBooked"   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "scheduledTime" TEXT;

-- Backfill: existing queue records are all pre-bookings
UPDATE "booking_queue" bq
  SET
    "isPreBooked"   = TRUE,
    "scheduledTime" = b."startTime"
  FROM "bookings" b
  WHERE bq."bookingId" = b."id";

-- Make isPreBooked NOT NULL after backfill
ALTER TABLE "booking_queue"
  ALTER COLUMN "isPreBooked" SET NOT NULL,
  ALTER COLUMN "isPreBooked" SET DEFAULT TRUE;

-- ============================================
-- 6. booking_queue: new index for priority sort
-- ============================================
CREATE INDEX IF NOT EXISTS "booking_queue_priority_sort_idx"
  ON "booking_queue" ("doctorId", "queueDate", "isPreBooked", "scheduledTime");
