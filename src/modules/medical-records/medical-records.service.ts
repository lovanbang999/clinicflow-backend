import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from 'src/common/exceptions/api.exception';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a Medical Record & associated Prescriptions
   */
  async upsertMedicalRecord(dto: CreateMedicalRecordDto, doctorId: string) {
    // Verify booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
      );
    }

    if (booking.doctorId !== doctorId) {
      throw new ApiException(
        MessageCodes.INVALID_QUERY,
        'You are not authorized to write records for this booking',
        403,
      );
    }

    const updatedRecord = await this.prisma.$transaction(async (tx) => {
      // Upsert Medical Record
      const record = await tx.medicalRecord.upsert({
        where: { bookingId: dto.bookingId },
        update: {
          chiefComplaint: dto.chiefComplaint,
          clinicalFindings: dto.clinicalFindings,
          diagnosisCode: dto.diagnosisCode,
          diagnosisName: dto.diagnosisName,
          treatmentPlan: dto.treatmentPlan,
          doctorNotes: dto.doctorNotes,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
          followUpNote: dto.followUpNote,
          isFinalized: dto.isFinalized ?? false,
        },
        create: {
          bookingId: dto.bookingId,
          patientProfileId: booking.patientProfileId,
          doctorId: booking.doctorId,
          chiefComplaint: dto.chiefComplaint,
          clinicalFindings: dto.clinicalFindings,
          diagnosisCode: dto.diagnosisCode,
          diagnosisName: dto.diagnosisName,
          treatmentPlan: dto.treatmentPlan,
          doctorNotes: dto.doctorNotes,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
          followUpNote: dto.followUpNote,
          isFinalized: dto.isFinalized ?? false,
        },
      });

      // Handle Prescription if items exist
      if (dto.prescriptionItems && dto.prescriptionItems.length > 0) {
        // Upsert Prescription Header
        const prescription = await tx.prescription.upsert({
          where: { medicalRecordId: record.id },
          update: {},
          create: {
            medicalRecordId: record.id,
            patientProfileId: booking.patientProfileId,
            doctorId: booking.doctorId,
          },
        });

        // Clear existing items and recreate
        await tx.prescriptionItem.deleteMany({
          where: { prescriptionId: prescription.id },
        });

        await tx.prescriptionItem.createMany({
          data: dto.prescriptionItems.map((item, index) => ({
            prescriptionId: prescription.id,
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            unit: item.unit,
            instructions: item.instructions,
            sortOrder: index,
          })),
        });
      } else {
        // If none provided, we could optionally clear prescriptions if we want a full sync behavior
        await tx.prescription.deleteMany({
          where: { medicalRecordId: record.id },
        });
      }

      // Handle completeVisit flag
      if (dto.completeVisit && booking.status !== 'COMPLETED') {
        const queue = await tx.bookingQueue.findUnique({
          where: { bookingId: booking.id },
        });

        if (queue) {
          await tx.bookingQueue.update({
            where: { id: queue.id },
            data: { completedAt: new Date() },
          });
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'COMPLETED',
            doctorNotes: dto.doctorNotes,
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            oldStatus: booking.status,
            newStatus: 'COMPLETED',
            changedById: doctorId,
            reason: 'Consultation finished',
          },
        });
      }

      // AUTO-CREATE PHARMACY INVOICE when finalizing with prescription items
      // Flow: Doctor completes visit → System creates PHARMACY invoice → Receptionist collects payment
      if (
        dto.completeVisit &&
        dto.prescriptionItems &&
        dto.prescriptionItems.length > 0
      ) {
        // Only create if no PHARMACY invoice exists yet for this booking
        const existingPharmacyInvoice = await tx.invoice.findFirst({
          where: { bookingId: dto.bookingId, invoiceType: 'PHARMACY' },
        });

        if (!existingPharmacyInvoice) {
          const count = await tx.invoice.count();
          const pharmacyInvoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

          const pharmacyInvoice = await tx.invoice.create({
            data: {
              bookingId: dto.bookingId,
              patientProfileId: booking.patientProfileId,
              invoiceType: 'PHARMACY',
              invoiceNumber: pharmacyInvoiceNumber,
              subtotal: 0,
              discountAmount: 0,
              vatRate: 0,
              vatAmount: 0,
              taxAmount: 0,
              totalAmount: 0,
              status: 'DRAFT',
              notes: 'Tự động tạo khi bác sĩ kê đơn thuốc',
            },
          });

          // Seed one item per prescription medicine
          for (let idx = 0; idx < dto.prescriptionItems.length; idx++) {
            const item = dto.prescriptionItems[idx];
            await tx.invoiceItem.create({
              data: {
                invoiceId: pharmacyInvoice.id,
                itemName: `${item.medicineName} (${item.dosage}, ${item.quantity} ${item.unit})`,
                unitPrice: 0, // Receptionist sets actual price
                quantity: item.quantity,
                totalPrice: 0,
                sortOrder: idx,
              },
            });
          }
        }
      }

      // Refetch the fully updated record inside transaction
      return tx.medicalRecord.findUnique({
        where: { id: record.id },
        include: {
          prescription: {
            include: { items: true },
          },
        },
      });
    });

    return ResponseHelper.success(
      updatedRecord,
      'EMR.UPSERT_SUCCESS',
      'Medical record saved successfully',
      200,
    );
  }

  /**
   * Search ICD-10 Codes (Mock implementation)
   */
  async searchICD10(query: string) {
    if (!query) {
      const dbResults = await this.prisma.icd10Code.findMany({
        take: 10,
        orderBy: { code: 'asc' },
      });
      return ResponseHelper.success(dbResults, 'ICD.SEARCH_SUCCESS', '', 200);
    }

    const lowerQuery = query.toLowerCase();
    const results = await this.prisma.icd10Code.findMany({
      where: {
        OR: [
          { code: { contains: lowerQuery, mode: 'insensitive' } },
          { name: { contains: lowerQuery, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { code: 'asc' },
    });

    return ResponseHelper.success(results, 'ICD.SEARCH_SUCCESS', '', 200);
  }

  /**
   * Get comprehensive Patient Medical Profile & Recent Visit History
   */
  async getPatientHistory(patientProfileId: string) {
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: {
        bookings: {
          where: {
            medicalRecord: { isNot: null },
          },
          orderBy: {
            bookingDate: 'desc',
          },
          take: 10, // Get last 10 visits
          include: {
            doctor: {
              select: {
                id: true,
                fullName: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
              },
            },
            medicalRecord: {
              include: {
                prescription: {
                  include: {
                    items: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!patientProfile) {
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
      );
    }

    return ResponseHelper.success(
      {
        patientProfile: {
          id: patientProfile.id,
          patientCode: patientProfile.patientCode,
          fullName: patientProfile.fullName,
          dateOfBirth: patientProfile.dateOfBirth,
          gender: patientProfile.gender,
          phone: patientProfile.phone,
          bloodType: patientProfile.bloodType,
          weightKg: patientProfile.weightKg?.toNumber(),
          heightCm: patientProfile.heightCm?.toNumber(),
          allergies: patientProfile.allergies,
          chronicConditions: patientProfile.chronicConditions,
          familyHistory: patientProfile.familyHistory,
          occupation: patientProfile.occupation,
          ethnicity: patientProfile.ethnicity,
        },
        recentVisits: patientProfile.bookings.map((b) => ({
          bookingId: b.id,
          bookingDate: b.bookingDate,
          doctorName: b.doctor.fullName,
          serviceName: b.service.name,
          medicalRecord: b.medicalRecord,
        })),
      },
      MessageCodes.PATIENT_HEALTH_PROFILE_RETRIEVED,
      'Patient history retrieved successfully',
      200,
    );
  }
}
