import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LabOrderStatus, Prisma, VisitStep } from '@prisma/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { OrderServicesDto } from './dto/order-services.dto';
import { SaveDiagnosisDto } from './dto/save-diagnosis.dto';
import { SaveSymptomsDto } from './dto/save-symptoms.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  private readonly visitIncludes = {
    visitServiceOrders: {
      include: { service: true },
      orderBy: { createdAt: 'asc' },
    },
    labOrders: {
      include: { result: true },
      orderBy: { createdAt: 'asc' },
    },
    prescription: {
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    },
    booking: {
      include: {
        doctor: true,
        patientProfile: true,
      },
    },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // PRIVATE HELPERS
  private async getVerifiedBooking(bookingId: string, doctorId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.doctorId !== doctorId)
      throw new ForbiddenException('You are not authorized for this booking');
    return booking;
  }

  private async getOrCreateRecord(
    bookingId: string,
    booking: { patientProfileId: string; doctorId: string },
  ) {
    return this.prisma.medicalRecord.upsert({
      where: { bookingId },
      create: {
        bookingId,
        patientProfileId: booking.patientProfileId,
        doctorId: booking.doctorId,
        visitStep: VisitStep.SYMPTOMS_TAKEN,
      },
      update: {},
    });
  }

  /** Auto-check if all VisitServiceOrders for a record are COMPLETED → advance step */
  private async maybeAdvanceToResultsReady(
    tx: Prisma.TransactionClient,
    medicalRecordId: string,
  ) {
    const allOrders = await tx.visitServiceOrder.findMany({
      where: { medicalRecordId },
      select: { status: true },
    });

    if (allOrders.length === 0) return;

    const allDone = allOrders.every(
      (o) => o.status === LabOrderStatus.COMPLETED,
    );
    if (allDone) {
      await tx.medicalRecord.update({
        where: { id: medicalRecordId },
        data: {
          visitStep: VisitStep.RESULTS_READY,
          version: { increment: 1 },
        },
      });
    }
  }

  // Save Symptoms
  async saveSymptoms(
    bookingId: string,
    dto: SaveSymptomsDto,
    doctorId: string,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId);

    const record = await this.prisma.medicalRecord.upsert({
      where: { bookingId },
      create: {
        bookingId,
        patientProfileId: (
          await this.prisma.booking.findUniqueOrThrow({
            where: { id: bookingId },
          })
        ).patientProfileId,
        doctorId,
        visitStep: VisitStep.SYMPTOMS_TAKEN,
        chiefComplaint: dto.chiefComplaint,
        clinicalFindings: dto.clinicalFindings,
        doctorNotes: dto.doctorNotes,
        bloodPressure: dto.bloodPressure,
        heartRate: dto.heartRate,
        temperature: dto.temperature,
        spO2: dto.spO2,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        bmi: dto.bmi,
        medicalHistory: dto.medicalHistory,
        allergies: dto.allergies,
        additionalSymptoms: dto.additionalSymptoms,
        symptomsAt: new Date(),
        version: 1,
      },
      update: {
        chiefComplaint: dto.chiefComplaint,
        clinicalFindings: dto.clinicalFindings,
        doctorNotes: dto.doctorNotes,
        bloodPressure: dto.bloodPressure,
        heartRate: dto.heartRate,
        temperature: dto.temperature,
        spO2: dto.spO2,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        bmi: dto.bmi,
        medicalHistory: dto.medicalHistory,
        allergies: dto.allergies,
        additionalSymptoms: dto.additionalSymptoms,
        symptomsAt: new Date(),
        visitStep: VisitStep.SYMPTOMS_TAKEN,
        version: { increment: 1 },
      },
      include: this.visitIncludes,
    });

    return ResponseHelper.success(
      record,
      'EMR.SYMPTOMS_SAVED',
      'Symptoms saved',
      200,
    );
  }

  // Order Services
  async orderServices(
    bookingId: string,
    dto: OrderServicesDto,
    doctorId: string,
  ) {
    const booking = await this.getVerifiedBooking(bookingId, doctorId);

    // Validate services exist
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, isActive: true },
    });
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException(
        'One or more service IDs are invalid or inactive',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Get or create MedicalRecord
      let record = await tx.medicalRecord.findUnique({ where: { bookingId } });
      if (!record) {
        record = await tx.medicalRecord.create({
          data: {
            bookingId,
            patientProfileId: booking.patientProfileId,
            doctorId: booking.doctorId,
            visitStep: VisitStep.SYMPTOMS_TAKEN,
          },
        });
      }

      // Guard: cannot order if already DIAGNOSED or later
      const lockedSteps: VisitStep[] = [
        VisitStep.DIAGNOSED,
        VisitStep.PRESCRIBED,
        VisitStep.COMPLETED,
      ];
      if (lockedSteps.includes(record.visitStep)) {
        throw new BadRequestException(
          'Cannot order services after diagnosis is finalized',
        );
      }

      // Create VisitServiceOrders (skip duplicates)
      const existing = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: record.id },
        select: { serviceId: true },
      });
      const existingIds = new Set(existing.map((o) => o.serviceId));
      const newServiceIds = dto.serviceIds.filter((id) => !existingIds.has(id));

      if (newServiceIds.length > 0) {
        await tx.visitServiceOrder.createMany({
          data: newServiceIds.map((serviceId) => ({
            medicalRecordId: record.id,
            serviceId,
            patientProfileId: booking.patientProfileId,
            bookingId,
            orderedBy: doctorId,
            status: LabOrderStatus.PENDING,
          })),
        });
      }

      // Advance step
      const newStep: VisitStep =
        record.visitStep === VisitStep.SYMPTOMS_TAKEN ||
        record.visitStep === VisitStep.SERVICES_ORDERED
          ? VisitStep.SERVICES_ORDERED
          : VisitStep.AWAITING_RESULTS;

      const updated = await tx.medicalRecord.update({
        where: { id: record.id },
        data: {
          visitStep: newStep,
          orderedAt: new Date(),
          version: { increment: 1 },
        },
        include: this.visitIncludes,
      });

      const orders = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: record.id },
        include: { service: true },
      });

      return { record: updated, orders };
    });

    return ResponseHelper.success(
      result,
      'EMR.SERVICES_ORDERED',
      'Services ordered',
      200,
    );
  }

  // Remove a Service Order (only if PENDING)
  async removeServiceOrder(
    bookingId: string,
    orderId: string,
    doctorId: string,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId);

    const order = await this.prisma.visitServiceOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.bookingId !== bookingId)
      throw new NotFoundException('Service order not found');
    if (order.status !== LabOrderStatus.PENDING)
      throw new ConflictException(
        'Cannot remove a service order that is already in progress',
      );

    await this.prisma.visitServiceOrder.delete({ where: { id: orderId } });
    return ResponseHelper.success(
      null,
      'EMR.ORDER_REMOVED',
      'Service order removed',
      200,
    );
  }

  // GET Results — composite response for B4
  async getVisitResults(bookingId: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { bookingId },
      include: this.visitIncludes,
    });

    if (!record) {
      // In early stages of an exam, the record might not exist yet. Return 200 with null.
      return ResponseHelper.success(null, 'EMR.NO_RECORD_YET', '', 200);
    }

    return ResponseHelper.success(record, 'EMR.RESULTS_FETCHED', '', 200);
  }

  // Save Diagnosis
  async saveDiagnosis(
    bookingId: string,
    dto: SaveDiagnosisDto,
    doctorId: string,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId);

    const record = await this.prisma.medicalRecord.findUnique({
      where: { bookingId },
    });
    if (!record)
      throw new NotFoundException(
        'Medical record not found. Complete B1 first.',
      );

    // Guard: can only diagnose when results are ready OR there are no service orders
    const orderCount = await this.prisma.visitServiceOrder.count({
      where: { medicalRecordId: record.id },
    });
    const allowedSteps: VisitStep[] = [
      VisitStep.RESULTS_READY,
      VisitStep.DIAGNOSED,
    ];
    if (orderCount > 0 && !allowedSteps.includes(record.visitStep)) {
      throw new BadRequestException(
        `Cannot save diagnosis: visit step is "${record.visitStep}". All service orders must be completed first.`,
      );
    }

    const updated = await this.prisma.medicalRecord.update({
      where: { id: record.id },
      data: {
        diagnosisCode: dto.diagnosisCode,
        diagnosisName: dto.diagnosisName,
        treatmentPlan: dto.treatmentPlan,
        doctorNotes: dto.doctorNotes,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        followUpNote: dto.followUpNote,
        visitStep: VisitStep.DIAGNOSED,
        diagnosedAt: new Date(),
        version: { increment: 1 },
      },
      include: this.visitIncludes,
    });

    return ResponseHelper.success(
      updated,
      'EMR.DIAGNOSIS_SAVED',
      'Diagnosis saved',
      200,
    );
  }

  // Save Prescription
  async savePrescription(
    bookingId: string,
    dto: CreatePrescriptionDto,
    doctorId: string,
  ) {
    const booking = await this.getVerifiedBooking(bookingId, doctorId);

    const record = await this.prisma.medicalRecord.findUnique({
      where: { bookingId },
    });
    if (!record)
      throw new NotFoundException(
        'Medical record not found. Complete B4 first.',
      );
    if (
      record.visitStep !== VisitStep.DIAGNOSED &&
      record.visitStep !== VisitStep.PRESCRIBED &&
      record.visitStep !== VisitStep.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot prescribe: visit step is "${record.visitStep}". Finalize diagnosis (B4) first.`,
      );
    }

    const updatedRecord = await this.prisma.$transaction(async (tx) => {
      // Upsert Prescription header
      const prescription = await tx.prescription.upsert({
        where: { medicalRecordId: record.id },
        create: {
          medicalRecordId: record.id,
          patientProfileId: booking.patientProfileId,
          doctorId,
          notes: dto.notes,
        },
        update: { notes: dto.notes },
      });

      // Replace all items
      await tx.prescriptionItem.deleteMany({
        where: { prescriptionId: prescription.id },
      });
      if (dto.items.length > 0) {
        await tx.prescriptionItem.createMany({
          data: dto.items.map((item, idx) => ({
            prescriptionId: prescription.id,
            visitServiceOrderId: item.visitServiceOrderId,
            labOrderId: item.labOrderId,
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            unit: item.unit ?? 'viên',
            instructions: item.instructions,
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      // Advance visitStep → PRESCRIBED / COMPLETED
      await tx.medicalRecord.update({
        where: { id: record.id },
        data: {
          visitStep: VisitStep.COMPLETED,
          isFinalized: true,
          prescribedAt: new Date(),
          version: { increment: 1 },
        },
      });

      // Mark booking COMPLETED & update queue
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'COMPLETED', doctorNotes: dto.notes },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: booking.status,
          newStatus: 'COMPLETED',
          changedById: doctorId,
          reason: 'Prescription issued — visit finalized',
        },
      });

      // Auto-create PHARMACY invoice if not exists
      const existingInvoice = await tx.invoice.findFirst({
        where: { bookingId, invoiceType: 'PHARMACY' },
      });
      if (!existingInvoice && dto.items.length > 0) {
        const count = await tx.invoice.count();
        const num = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
        const inv = await tx.invoice.create({
          data: {
            bookingId,
            patientProfileId: booking.patientProfileId,
            invoiceType: 'PHARMACY',
            invoiceNumber: num,
            subtotal: 0,
            discountAmount: 0,
            vatRate: 0,
            vatAmount: 0,
            taxAmount: 0,
            totalAmount: 0,
            status: 'DRAFT',
            notes: 'Auto-created on prescription',
          },
        });
        await tx.invoiceItem.createMany({
          data: dto.items.map((item, idx) => ({
            invoiceId: inv.id,
            itemName: `${item.medicineName} (${item.dosage}, ${item.quantity} ${item.unit ?? 'viên'})`,
            unitPrice: 0,
            quantity: item.quantity,
            totalPrice: 0,
            sortOrder: idx,
          })),
        });
      }

      return tx.medicalRecord.findUnique({
        where: { id: record.id },
        include: this.visitIncludes,
      });
    });

    // Send post-visit email (non-blocking)
    if (updatedRecord) {
      this.sendPostVisitEmailSafe(updatedRecord, dto).catch((err) =>
        this.logger.error('Post-visit email failed', err),
      );
    }

    return ResponseHelper.success(
      updatedRecord,
      'EMR.PRESCRIPTION_SAVED',
      'Prescription saved',
      200,
    );
  }

  private async sendPostVisitEmailSafe(
    record: { bookingId: string; diagnosisName?: string | null },
    dto: CreatePrescriptionDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: record.bookingId },
      include: {
        patientProfile: { include: { user: { select: { email: true } } } },
        doctor: true,
        service: true,
      },
    });
    if (!booking?.patientProfile?.user?.email) return;

    await this.notificationsService.sendPostVisitEmail({
      bookingId: booking.bookingCode ?? booking.id,
      patientId: booking.patientProfile.userId ?? undefined,
      patientName: booking.patientProfile.fullName,
      patientEmail: booking.patientProfile.user.email,
      doctorName: booking.doctor.fullName,
      serviceName: booking.service.name,
      bookingDate: format(booking.bookingDate, 'EEEE, dd/MM/yyyy', {
        locale: vi,
      }),
      startTime: booking.startTime ?? '',
      endTime: booking.endTime ?? '',
      duration: booking.service.durationMinutes,
      status: booking.status as string,
      diagnosisName: record.diagnosisName ?? undefined,
      hasPrescription: dto.items.length > 0,
    });
  }

  // LEGACY: Kept for compatibility — delegates to step engine
  async upsertMedicalRecord(dto: CreateMedicalRecordDto, doctorId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking)
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
      );
    if (booking.doctorId !== doctorId)
      throw new ApiException(MessageCodes.INVALID_QUERY, 'Not authorized', 403);

    // Route to step engine based on what data is present
    if (
      dto.prescriptionItems &&
      dto.prescriptionItems.length > 0 &&
      dto.diagnosisCode
    ) {
      await this.saveSymptoms(
        dto.bookingId,
        {
          chiefComplaint: dto.chiefComplaint,
          clinicalFindings: dto.clinicalFindings,
          doctorNotes: dto.doctorNotes,
        },
        doctorId,
      );
      await this.saveDiagnosis(
        dto.bookingId,
        {
          diagnosisCode: dto.diagnosisCode,
          diagnosisName: dto.diagnosisName,
          treatmentPlan: dto.treatmentPlan,
          followUpDate: dto.followUpDate,
          followUpNote: dto.followUpNote,
        },
        doctorId,
      );
      return this.savePrescription(
        dto.bookingId,
        {
          notes: undefined,
          items: dto.prescriptionItems.map((i) => ({
            visitServiceOrderId: undefined, // Legacy flow does not support linking
            medicineName: i.medicineName,
            dosage: i.dosage,
            frequency: i.frequency,
            durationDays: i.durationDays,
            quantity: i.quantity,
            unit: i.unit,
            instructions: i.instructions,
          })),
        },
        doctorId,
      );
    }

    return this.saveSymptoms(
      dto.bookingId,
      {
        chiefComplaint: dto.chiefComplaint,
        clinicalFindings: dto.clinicalFindings,
        doctorNotes: dto.doctorNotes,
      },
      doctorId,
    );
  }

  // ICD-10 Search
  async searchICD10(query: string) {
    if (!query) {
      const results = await this.prisma.icd10Code.findMany({
        take: 10,
        orderBy: { code: 'asc' },
      });
      return ResponseHelper.success(results, 'ICD.SEARCH_SUCCESS', '', 200);
    }
    const results = await this.prisma.icd10Code.findMany({
      where: {
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { code: 'asc' },
    });
    return ResponseHelper.success(results, 'ICD.SEARCH_SUCCESS', '', 200);
  }

  // Patient History
  async getPatientHistory(patientProfileId: string, page = 1, limit = 10) {
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
    });
    if (!patientProfile)
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
      );

    const skip = (page - 1) * limit;
    const [visits, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where: { patientProfileId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          booking: {
            include: {
              doctor: { select: { id: true, fullName: true } },
              service: { select: { id: true, name: true } },
            },
          },
          visitServiceOrders: { include: { service: true } },
          prescription: {
            include: { items: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      }),
      this.prisma.medicalRecord.count({ where: { patientProfileId } }),
    ]);

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
          allergies: patientProfile.allergies,
          chronicConditions: patientProfile.chronicConditions,
        },
        visits,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      MessageCodes.PATIENT_HEALTH_PROFILE_RETRIEVED,
      'Patient history retrieved',
      200,
    );
  }

  // Auto-advance MedicalRecord step (called by VisitServiceOrdersService)
  async checkAndAdvanceToResultsReady(medicalRecordId: string) {
    await this.prisma.$transaction((tx) =>
      this.maybeAdvanceToResultsReady(tx, medicalRecordId),
    );
  }

  // Patient my-visits (self-service)
  async getMyVisits(userId: string, page = 1, limit = 10) {
    const patientProfile = await this.prisma.patientProfile.findFirst({
      where: { userId },
    });
    if (!patientProfile)
      throw new NotFoundException('Patient profile not found');

    return this.getPatientHistory(patientProfile.id, page, limit);
  }

  // Patient visit stats
  async getPatientStats(userId: string) {
    const patientProfile = await this.prisma.patientProfile.findFirst({
      where: { userId },
    });
    if (!patientProfile)
      throw new NotFoundException('Patient profile not found');

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [totalVisits, visitsThisYear, activeBookings, abnormalResults] =
      await Promise.all([
        this.prisma.medicalRecord.count({
          where: { patientProfileId: patientProfile.id },
        }),
        this.prisma.medicalRecord.count({
          where: {
            patientProfileId: patientProfile.id,
            createdAt: { gte: startOfYear },
          },
        }),
        this.prisma.booking.count({
          where: {
            patientProfileId: patientProfile.id,
            status: {
              in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
            },
          },
        }),
        this.prisma.visitServiceOrder.count({
          where: {
            patientProfileId: patientProfile.id,
            isAbnormal: true,
          },
        }),
      ]);

    return ResponseHelper.success(
      {
        totalVisits,
        visitsThisYear,
        activeBookings,
        abnormalResults,
      },
      'PATIENT.STATS_RETRIEVED',
      'Patient stats retrieved',
      200,
    );
  }

  // Doctor stats
  async getDoctorStats(doctorId: string) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayPatients, monthPatients, totalRecords, pendingVisits] =
      await Promise.all([
        this.prisma.booking.count({
          where: {
            doctorId,
            bookingDate: {
              gte: startOfToday,
              lt: new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
              ),
            },
            status: {
              in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'],
            },
          },
        }),
        this.prisma.booking.count({
          where: {
            doctorId,
            bookingDate: { gte: startOfMonth },
            status: {
              in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'],
            },
          },
        }),
        this.prisma.medicalRecord.count({ where: { doctorId } }),
        this.prisma.booking.count({
          where: {
            doctorId,
            status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          },
        }),
      ]);

    return ResponseHelper.success(
      {
        todayPatients,
        monthPatients,
        totalRecords,
        pendingVisits,
      },
      'DOCTOR.STATS_RETRIEVED',
      'Doctor stats retrieved',
      200,
    );
  }
}
