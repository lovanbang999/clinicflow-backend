-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "bloodPressure" TEXT,
ADD COLUMN     "bmi" DECIMAL(4,1),
ADD COLUMN     "heartRate" INTEGER,
ADD COLUMN     "heightCm" DECIMAL(5,1),
ADD COLUMN     "medicalHistory" TEXT,
ADD COLUMN     "spO2" INTEGER,
ADD COLUMN     "temperature" DECIMAL(4,1),
ADD COLUMN     "weightKg" DECIMAL(5,2);
