-- CreateTable
CREATE TABLE "doctor_services" (
    "id" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_services_doctorProfileId_idx" ON "doctor_services"("doctorProfileId");

-- CreateIndex
CREATE INDEX "doctor_services_serviceId_idx" ON "doctor_services"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_services_doctorProfileId_serviceId_key" ON "doctor_services"("doctorProfileId", "serviceId");

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
