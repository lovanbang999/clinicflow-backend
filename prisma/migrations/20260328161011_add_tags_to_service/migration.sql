-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_ACTIVITY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScheduleSlotStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "ScheduleSlotStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "estimatedTime" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "preparationNotes" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- RenameIndex
ALTER INDEX "booking_queue_priority_sort_idx" RENAME TO "booking_queue_doctorId_queueDate_isPreBooked_scheduledTime_idx";
