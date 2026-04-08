-- CreateTable
CREATE TABLE `icd10_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `icd10_codes_code_key`(`code`),
    INDEX `icd10_codes_code_idx`(`code`),
    INDEX `icd10_codes_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN', 'TECHNICIAN') NOT NULL DEFAULT 'PATIENT',
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `dateOfBirth` DATE NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `address` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isRevoked` BOOLEAN NOT NULL DEFAULT false,
    `deviceInfo` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_codes` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `verification_codes_userId_type_isUsed_idx`(`userId`, `type`, `isUsed`),
    INDEX `verification_codes_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `specialties` JSON NOT NULL,
    `qualifications` JSON NOT NULL,
    `yearsOfExperience` INTEGER NOT NULL DEFAULT 0,
    `bio` VARCHAR(191) NULL,
    `consultationFee` DECIMAL(12, 2) NULL,
    `rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `doctor_profiles_userId_key`(`userId`),
    INDEX `doctor_profiles_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_working_hours` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `doctor_working_hours_doctorId_idx`(`doctorId`),
    UNIQUE INDEX `doctor_working_hours_doctorId_dayOfWeek_key`(`doctorId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_break_times` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `breakDate` DATE NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `doctor_break_times_doctorId_breakDate_idx`(`doctorId`, `breakDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_off_days` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `offDate` DATE NOT NULL,
    `reason` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `doctor_off_days_doctorId_idx`(`doctorId`),
    UNIQUE INDEX `doctor_off_days_doctorId_offDate_key`(`doctorId`, `offDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_schedule_slots` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `maxPatients` INTEGER NOT NULL DEFAULT 1,
    `bookedCount` INTEGER NOT NULL DEFAULT 0,
    `type` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'BLOCKED', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'SCHEDULED',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `maxPreBookings` INTEGER NOT NULL DEFAULT 1,
    `maxQueueSize` INTEGER NOT NULL DEFAULT 10,
    `preBookedCount` INTEGER NOT NULL DEFAULT 0,
    `queueCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `doctor_schedule_slots_doctorId_date_idx`(`doctorId`, `date`),
    INDEX `doctor_schedule_slots_roomId_date_idx`(`roomId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('CONSULTATION', 'ULTRASOUND', 'PROCEDURE', 'LAB', 'WAITING') NOT NULL DEFAULT 'CONSULTATION',
    `floor` VARCHAR(191) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rooms_name_key`(`name`),
    INDEX `rooms_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patient_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `dateOfBirth` DATE NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `address` VARCHAR(191) NULL,
    `patientCode` VARCHAR(191) NOT NULL,
    `isGuest` BOOLEAN NOT NULL DEFAULT false,
    `nationalId` VARCHAR(191) NULL,
    `bloodType` VARCHAR(191) NULL,
    `heightCm` DECIMAL(5, 1) NULL,
    `weightKg` DECIMAL(5, 1) NULL,
    `insuranceNumber` VARCHAR(191) NULL,
    `insuranceProvider` VARCHAR(191) NULL,
    `insuranceType` VARCHAR(191) NULL,
    `insuranceExpiry` DATE NULL,
    `insuranceCardFront` VARCHAR(191) NULL,
    `insuranceCardBack` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `emergencyContactRelation` VARCHAR(191) NULL,
    `allergies` VARCHAR(191) NULL,
    `chronicConditions` VARCHAR(191) NULL,
    `familyHistory` VARCHAR(191) NULL,
    `occupation` VARCHAR(191) NULL,
    `ethnicity` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `patient_profiles_userId_key`(`userId`),
    UNIQUE INDEX `patient_profiles_patientCode_key`(`patientCode`),
    INDEX `patient_profiles_userId_idx`(`userId`),
    INDEX `patient_profiles_patientCode_idx`(`patientCode`),
    INDEX `patient_profiles_phone_idx`(`phone`),
    INDEX `patient_profiles_nationalId_idx`(`nationalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('EXAMINATION', 'LAB') NOT NULL DEFAULT 'LAB',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_code_key`(`code`),
    INDEX `categories_isActive_idx`(`isActive`),
    INDEX `categories_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `iconUrl` VARCHAR(191) NULL,
    `serviceCode` VARCHAR(191) NULL,
    `durationMinutes` INTEGER NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `maxSlotsPerHour` INTEGER NOT NULL DEFAULT 2,
    `categoryId` VARCHAR(191) NULL,
    `preparationNotes` VARCHAR(191) NULL,
    `tags` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_name_key`(`name`),
    UNIQUE INDEX `services_serviceCode_key`(`serviceCode`),
    INDEX `services_isActive_idx`(`isActive`),
    INDEX `services_categoryId_idx`(`categoryId`),
    INDEX `services_serviceCode_idx`(`serviceCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_services` (
    `id` VARCHAR(191) NOT NULL,
    `doctorProfileId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `doctor_services_doctorProfileId_idx`(`doctorProfileId`),
    INDEX `doctor_services_serviceId_idx`(`serviceId`),
    UNIQUE INDEX `doctor_services_doctorProfileId_serviceId_key`(`doctorProfileId`, `serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `bookingCode` VARCHAR(191) NOT NULL,
    `bookingDate` DATE NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `isPreBooked` BOOLEAN NOT NULL DEFAULT true,
    `estimatedTime` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'QUEUED') NOT NULL DEFAULT 'PENDING',
    `source` ENUM('ONLINE', 'WALK_IN', 'PHONE', 'RECEPTIONIST') NOT NULL DEFAULT 'ONLINE',
    `priority` ENUM('NORMAL', 'URGENT', 'EMERGENCY') NOT NULL DEFAULT 'NORMAL',
    `bookedBy` VARCHAR(191) NULL,
    `patientNotes` VARCHAR(191) NULL,
    `doctorNotes` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `checkedInAt` DATETIME(3) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_bookingCode_key`(`bookingCode`),
    INDEX `bookings_patientProfileId_idx`(`patientProfileId`),
    INDEX `bookings_doctorId_idx`(`doctorId`),
    INDEX `bookings_bookingDate_idx`(`bookingDate`),
    INDEX `bookings_status_idx`(`status`),
    INDEX `bookings_bookingCode_idx`(`bookingCode`),
    INDEX `bookings_isPreBooked_idx`(`isPreBooked`),
    INDEX `bookings_doctorId_bookingDate_isPreBooked_idx`(`doctorId`, `bookingDate`, `isPreBooked`),
    INDEX `bookings_doctorId_bookingDate_startTime_idx`(`doctorId`, `bookingDate`, `startTime`),
    INDEX `bookings_doctorId_bookingDate_status_idx`(`doctorId`, `bookingDate`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_queue` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `queueDate` DATE NOT NULL,
    `queuePosition` INTEGER NOT NULL,
    `estimatedWaitMinutes` INTEGER NOT NULL DEFAULT 0,
    `isPreBooked` BOOLEAN NOT NULL DEFAULT true,
    `scheduledTime` VARCHAR(191) NULL,
    `calledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `booking_queue_bookingId_key`(`bookingId`),
    INDEX `booking_queue_doctorId_queueDate_idx`(`doctorId`, `queueDate`),
    INDEX `booking_queue_doctorId_queueDate_queuePosition_idx`(`doctorId`, `queueDate`, `queuePosition`),
    INDEX `booking_queue_doctorId_queueDate_isPreBooked_scheduledTime_idx`(`doctorId`, `queueDate`, `isPreBooked`, `scheduledTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `oldStatus` ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'QUEUED') NULL,
    `newStatus` ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'QUEUED') NOT NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_status_history_bookingId_idx`(`bookingId`),
    INDEX `booking_status_history_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_records` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `visitStep` ENUM('SYMPTOMS_TAKEN', 'SERVICES_ORDERED', 'AWAITING_RESULTS', 'RESULTS_READY', 'DIAGNOSED', 'PRESCRIBED', 'COMPLETED') NOT NULL DEFAULT 'SYMPTOMS_TAKEN',
    `version` INTEGER NOT NULL DEFAULT 0,
    `chiefComplaint` VARCHAR(191) NULL,
    `clinicalFindings` VARCHAR(191) NULL,
    `doctorNotes` VARCHAR(191) NULL,
    `bloodPressure` VARCHAR(191) NULL,
    `heartRate` INTEGER NULL,
    `temperature` DECIMAL(4, 1) NULL,
    `spO2` INTEGER NULL,
    `weightKg` DECIMAL(5, 2) NULL,
    `heightCm` DECIMAL(5, 1) NULL,
    `bmi` DECIMAL(4, 1) NULL,
    `medicalHistory` VARCHAR(191) NULL,
    `allergies` VARCHAR(191) NULL,
    `additionalSymptoms` VARCHAR(191) NULL,
    `symptomsAt` DATETIME(3) NULL,
    `diagnosisCode` VARCHAR(191) NULL,
    `diagnosisName` VARCHAR(191) NULL,
    `treatmentPlan` VARCHAR(191) NULL,
    `followUpDate` DATE NULL,
    `followUpNote` VARCHAR(191) NULL,
    `diagnosedAt` DATETIME(3) NULL,
    `orderedAt` DATETIME(3) NULL,
    `prescribedAt` DATETIME(3) NULL,
    `isFinalized` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medical_records_bookingId_key`(`bookingId`),
    INDEX `medical_records_patientProfileId_createdAt_idx`(`patientProfileId`, `createdAt` DESC),
    INDEX `medical_records_doctorId_idx`(`doctorId`),
    INDEX `medical_records_bookingId_idx`(`bookingId`),
    INDEX `medical_records_visitStep_idx`(`visitStep`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visit_service_orders` (
    `id` VARCHAR(191) NOT NULL,
    `medicalRecordId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `orderedBy` VARCHAR(191) NOT NULL,
    `performedBy` VARCHAR(191) NULL,
    `resultText` VARCHAR(191) NULL,
    `resultFileUrl` VARCHAR(191) NULL,
    `isAbnormal` BOOLEAN NULL,
    `abnormalNote` VARCHAR(191) NULL,
    `labOrderId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `visit_service_orders_labOrderId_key`(`labOrderId`),
    INDEX `visit_service_orders_medicalRecordId_idx`(`medicalRecordId`),
    INDEX `visit_service_orders_patientProfileId_idx`(`patientProfileId`),
    INDEX `visit_service_orders_status_idx`(`status`),
    INDEX `visit_service_orders_bookingId_idx`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescriptions` (
    `id` VARCHAR(191) NOT NULL,
    `medicalRecordId` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isPrinted` BOOLEAN NOT NULL DEFAULT false,
    `printedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prescriptions_medicalRecordId_key`(`medicalRecordId`),
    INDEX `prescriptions_patientProfileId_idx`(`patientProfileId`),
    INDEX `prescriptions_medicalRecordId_idx`(`medicalRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescription_items` (
    `id` VARCHAR(191) NOT NULL,
    `prescriptionId` VARCHAR(191) NOT NULL,
    `visitServiceOrderId` VARCHAR(191) NULL,
    `labOrderId` VARCHAR(191) NULL,
    `medicineName` VARCHAR(191) NOT NULL,
    `dosage` VARCHAR(191) NOT NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `durationDays` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'viên',
    `instructions` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prescription_items_prescriptionId_idx`(`prescriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lab_orders` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `medicalRecordId` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `testName` VARCHAR(191) NOT NULL,
    `testDescription` VARCHAR(191) NULL,
    `serviceId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `orderedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lab_orders_patientProfileId_idx`(`patientProfileId`),
    INDEX `lab_orders_medicalRecordId_idx`(`medicalRecordId`),
    INDEX `lab_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lab_results` (
    `id` VARCHAR(191) NOT NULL,
    `labOrderId` VARCHAR(191) NOT NULL,
    `resultText` VARCHAR(191) NULL,
    `resultFileUrl` VARCHAR(191) NULL,
    `isAbnormal` BOOLEAN NULL,
    `abnormalNote` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `resultDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lab_results_labOrderId_key`(`labOrderId`),
    INDEX `lab_results_labOrderId_idx`(`labOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NOT NULL,
    `invoiceType` ENUM('CONSULTATION', 'LAB', 'PHARMACY') NOT NULL DEFAULT 'CONSULTATION',
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `vatRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `vatAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'ISSUED', 'PAID', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `insuranceClaimed` BOOLEAN NOT NULL DEFAULT false,
    `insuranceAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `patientCoPayment` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `einvoiceCode` VARCHAR(191) NULL,
    `einvoiceStatus` ENUM('PENDING', 'ISSUED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `einvoiceUrl` VARCHAR(191) NULL,
    `einvoiceIssuedAt` DATETIME(3) NULL,
    `issuedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `invoices_bookingId_idx`(`bookingId`),
    INDEX `invoices_patientProfileId_idx`(`patientProfileId`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_paidAt_idx`(`paidAt`),
    INDEX `invoices_einvoiceStatus_idx`(`einvoiceStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `labOrderId` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `totalPrice` DECIMAL(12, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoice_items_labOrderId_key`(`labOrderId`),
    INDEX `invoice_items_invoiceId_idx`(`invoiceId`),
    INDEX `invoice_items_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amountPaid` DECIMAL(12, 2) NOT NULL,
    `insuranceCovered` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `patientPaid` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'INSURANCE', 'CARD') NOT NULL,
    `insuranceNumber` VARCHAR(191) NULL,
    `transactionRef` VARCHAR(191) NULL,
    `confirmedBy` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestEmail` VARCHAR(191) NULL,
    `guestPhone` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `type` ENUM('APPOINTMENT_REMINDER', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'LAB_RESULT_READY', 'INVOICE_ISSUED', 'SYSTEM', 'ADMIN_ACTIVITY') NOT NULL,
    `channel` ENUM('EMAIL', 'PUSH', 'SMS', 'IN_APP') NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `metadata` JSON NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `nextRetryAt` DATETIME(3) NULL,
    `provider` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `notifications_userId_createdAt_idx`(`userId`, `createdAt` DESC),
    INDEX `notifications_nextRetryAt_idx`(`nextRetryAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_actorId_createdAt_idx`(`actorId`, `createdAt` DESC),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `dataType` VARCHAR(191) NOT NULL DEFAULT 'string',
    `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `description` VARCHAR(191) NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `isSecret` BOOLEAN NOT NULL DEFAULT false,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_key_key`(`key`),
    INDEX `system_configs_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_chat_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `patientProfileId` VARCHAR(191) NULL,
    `modelName` VARCHAR(191) NOT NULL DEFAULT 'gemini-2.5-flash',
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `outcome` ENUM('ONGOING', 'BOOKING_MADE', 'ABANDONED', 'REPORTED') NOT NULL DEFAULT 'ONGOING',
    `bookingId` VARCHAR(191) NULL,
    `feedbackRating` INTEGER NULL,
    `feedbackNote` VARCHAR(191) NULL,
    `reportedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_chat_sessions_userId_startedAt_idx`(`userId`, `startedAt` DESC),
    INDEX `ai_chat_sessions_outcome_idx`(`outcome`),
    INDEX `ai_chat_sessions_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_chat_messages` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'MODEL', 'TOOL') NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `toolName` VARCHAR(191) NULL,
    `toolInput` JSON NULL,
    `toolOutput` JSON NULL,
    `toolError` VARCHAR(191) NULL,
    `tokenCount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_chat_messages_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    INDEX `ai_chat_messages_toolName_idx`(`toolName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_codes` ADD CONSTRAINT `verification_codes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_profiles` ADD CONSTRAINT `doctor_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_working_hours` ADD CONSTRAINT `doctor_working_hours_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_break_times` ADD CONSTRAINT `doctor_break_times_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_off_days` ADD CONSTRAINT `doctor_off_days_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_off_days` ADD CONSTRAINT `doctor_off_days_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_schedule_slots` ADD CONSTRAINT `doctor_schedule_slots_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_schedule_slots` ADD CONSTRAINT `doctor_schedule_slots_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patient_profiles` ADD CONSTRAINT `patient_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_services` ADD CONSTRAINT `doctor_services_doctorProfileId_fkey` FOREIGN KEY (`doctorProfileId`) REFERENCES `doctor_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_services` ADD CONSTRAINT `doctor_services_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_patientProfileId_fkey` FOREIGN KEY (`patientProfileId`) REFERENCES `patient_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_bookedBy_fkey` FOREIGN KEY (`bookedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_cancelledBy_fkey` FOREIGN KEY (`cancelledBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_queue` ADD CONSTRAINT `booking_queue_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visit_service_orders` ADD CONSTRAINT `visit_service_orders_medicalRecordId_fkey` FOREIGN KEY (`medicalRecordId`) REFERENCES `medical_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visit_service_orders` ADD CONSTRAINT `visit_service_orders_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_medicalRecordId_fkey` FOREIGN KEY (`medicalRecordId`) REFERENCES `medical_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_visitServiceOrderId_fkey` FOREIGN KEY (`visitServiceOrderId`) REFERENCES `visit_service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_labOrderId_fkey` FOREIGN KEY (`labOrderId`) REFERENCES `lab_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `prescriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_orders` ADD CONSTRAINT `lab_orders_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_orders` ADD CONSTRAINT `lab_orders_medicalRecordId_fkey` FOREIGN KEY (`medicalRecordId`) REFERENCES `medical_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_orders` ADD CONSTRAINT `lab_orders_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_results` ADD CONSTRAINT `lab_results_labOrderId_fkey` FOREIGN KEY (`labOrderId`) REFERENCES `lab_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_results` ADD CONSTRAINT `lab_results_recordedBy_fkey` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_labOrderId_fkey` FOREIGN KEY (`labOrderId`) REFERENCES `lab_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_confirmedBy_fkey` FOREIGN KEY (`confirmedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configs` ADD CONSTRAINT `system_configs_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ai_chat_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
