-- Fix: Allow new bookings after COMPLETED status
-- Drop old partial unique index that only excluded CANCELLED and NO_SHOW
DROP INDEX IF EXISTS "uq_patient_doctor_date_active";

-- Recreate with COMPLETED also excluded
-- Rule: 1 patient + 1 doctor + 1 date = max 1 active (non-terminal) booking
CREATE UNIQUE INDEX "uq_patient_doctor_date_active"
  ON "bookings" ("patientProfileId", "doctorId", "bookingDate")
  WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED');
