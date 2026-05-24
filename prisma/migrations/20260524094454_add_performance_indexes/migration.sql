/*
  Warnings:

  - A unique constraint covering the columns `[doctorId,bookingDate,startTime]` on the table `slot_reservations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE `sequence_counters` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sequence_counters_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `bookings_patientProfileId_status_idx` ON `bookings`(`patientProfileId`, `status`);

-- CreateIndex
CREATE INDEX `bookings_bookingDate_status_idx` ON `bookings`(`bookingDate`, `status`);

-- CreateIndex
CREATE INDEX `doctor_schedule_slots_status_date_idx` ON `doctor_schedule_slots`(`status`, `date`);

-- CreateIndex
CREATE INDEX `invoices_status_createdAt_idx` ON `invoices`(`status`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `slot_reservations_doctorId_bookingDate_startTime_key` ON `slot_reservations`(`doctorId`, `bookingDate`, `startTime`);
