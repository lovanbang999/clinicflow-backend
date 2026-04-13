import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../database/interfaces/user.repository.interface';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../database/interfaces/booking.repository.interface';
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../database/interfaces/profile.repository.interface';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Prisma, VisitStep } from '@prisma/client';
import { ServiceOrderStatus } from '../../common/constants/enums';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
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
      include: { result: true, service: true },
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
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly notificationsService: NotificationsService,
    private readonly billingService: BillingService,
  ) {}

  // PRIVATE HELPERS
  private async getVerifiedBooking(
    bookingId: string,
    doctorId: string,
    currentUser?: Express.User,
  ) {
    const booking = await this.bookingRepository.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Ownership check: If doctor, must be the assigned doctor
    if (
      currentUser?.role === 'DOCTOR' &&
      booking.doctorId !== currentUser.id &&
      booking.doctorId !== doctorId
    ) {
      throw new ForbiddenException('You are not authorized for this booking');
    }

    return booking;
  }

  /**
   * Verified if the requester has a treatment relationship with the patient.
   * - Patient: Always if it's their own record.
   * - Doctor: If they are currently assigned or have treated them before.
   * - Admin: Always.
   */
  private async validateTreatmentRelation(
    patientProfileId: string,
    currentUser?: Express.User,
  ) {
    if (!currentUser) return; // For internal calls

    if (currentUser.role === 'ADMIN') return;

    if (currentUser.role === 'PATIENT') {
      const profile = await this.profileRepository.findFirstPatientProfile({
        where: { userId: currentUser.id },
      });
      if (!profile || profile.id !== patientProfileId) {
        throw new ForbiddenException(
          'You can only access your own medical records',
        );
      }
      return;
    }

    if (currentUser.role === 'DOCTOR') {
      // Check for ANY active or COMPLETED booking between this doctor and patient
      const treatmentRelation = await this.bookingRepository.findFirst({
        where: {
          doctorId: currentUser.id,
          patientProfileId,
          status: {
            in: [
              'CONFIRMED',
              'CHECKED_IN',
              'IN_PROGRESS',
              'COMPLETED',
              'PENDING',
            ],
          },
        },
      });

      if (!treatmentRelation) {
        throw new ForbiddenException(
          'You are not authorized to view this patient history (No prior treatment relationship)',
        );
      }
      return;
    }

    throw new ForbiddenException('Unauthorized access');
  }

  private async getOrCreateRecord(
    bookingId: string,
    booking: { patientProfileId: string; doctorId: string },
  ) {
    return this.clinicalRepository.transaction(async (tx) => {
      return tx.medicalRecord.upsert({
        where: { bookingId },
        create: {
          bookingId,
          patientProfileId: booking.patientProfileId,
          doctorId: booking.doctorId,
          visitStep: VisitStep.SYMPTOMS_TAKEN,
        },
        update: {},
      });
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
      (o) => o.status === ServiceOrderStatus.COMPLETED,
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
    currentUser?: Express.User,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId, currentUser);

    const record = await this.clinicalRepository.transaction(async (tx) => {
      const b = await this.bookingRepository.findUnique({
        where: { id: bookingId },
      });
      if (!b) throw new NotFoundException('Booking not found');

      return tx.medicalRecord.upsert({
        where: { bookingId },
        create: {
          bookingId,
          patientProfileId: b.patientProfileId,
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
    currentUser?: Express.User,
  ) {
    const booking = await this.getVerifiedBooking(
      bookingId,
      doctorId,
      currentUser,
    );

    // Validate services exist
    const services = await this.clinicalRepository.transaction(async (tx) => {
      return tx.service.findMany({
        where: { id: { in: dto.serviceIds }, isActive: true },
      });
    });
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException(
        'One or more service IDs are invalid or inactive',
      );
    }

    const result = await this.clinicalRepository.transaction(async (tx) => {
      // Get or create MedicalRecord
      let record = await tx.medicalRecord.findUnique({
        where: { bookingId },
      });
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
            status: ServiceOrderStatus.PENDING,
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

    // Auto-sync to draft invoice
    await this.billingService.syncLabInvoice(bookingId);

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
    currentUser?: Express.User,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId, currentUser);

    const order = await this.clinicalRepository.findUniqueVisitServiceOrder({
      where: { id: orderId },
    });
    if (!order || order.bookingId !== bookingId)
      throw new NotFoundException('Service order not found');
    if (order.status !== ServiceOrderStatus.PENDING)
      throw new ConflictException(
        'Cannot remove a service order that is already in progress',
      );

    await this.clinicalRepository.deleteVisitServiceOrder({
      where: { id: orderId },
    });

    // Auto-sync after removal
    await this.billingService.syncLabInvoice(bookingId);

    return ResponseHelper.success(
      null,
      'EMR.ORDER_REMOVED',
      'Service order removed',
      200,
    );
  }

  // GET Results — composite response for B4
  async getVisitResults(bookingId: string, currentUser?: Express.User) {
    const booking = await this.bookingRepository.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Ownership check for doctors/patients
    await this.validateTreatmentRelation(booking.patientProfileId, currentUser);
    const record = await this.clinicalRepository.findUniqueMedicalRecord({
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
    currentUser?: Express.User,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId, currentUser);

    const record = await this.clinicalRepository.findUniqueMedicalRecord({
      where: { bookingId },
    });
    if (!record)
      throw new NotFoundException(
        'Medical record not found. Complete B1 first.',
      );

    // Guard: can only diagnose when results are ready OR there are no service orders
    const orderCount = await this.clinicalRepository.countVisitServiceOrder({
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

    const updated = await this.clinicalRepository.updateMedicalRecord({
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
    currentUser?: Express.User,
  ) {
    const booking = await this.getVerifiedBooking(
      bookingId,
      doctorId,
      currentUser,
    );

    const record = await this.clinicalRepository.findUniqueMedicalRecord({
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

    const updatedRecord = await this.clinicalRepository.transaction(
      async (tx) => {
        // Upsert Prescription header
        const prescription = await tx.prescription.upsert({
          where: { medicalRecordId: record.id },
          create: {
            medicalRecordId: record.id,
            patientProfileId: booking.patientProfileId,
            doctorId,
            notes: dto.notes,
            isFulfilledInternally: null, // null = patient has not decided yet
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

        // NOTE (v5.0): PHARMACY invoice is NOT auto-created here.
        // Receptionist will create it manually if the patient chooses to buy medicine at the clinic (B8).

        return tx.medicalRecord.findUnique({
          where: { id: record.id },
          include: this.visitIncludes,
        });
      },
    );

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
    const booking = await this.bookingRepository.findUnique({
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
      serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
      bookingDate: format(booking.bookingDate, 'EEEE, dd/MM/yyyy', {
        locale: vi,
      }),
      startTime: booking.startTime ?? '',
      endTime: booking.endTime ?? '',
      duration: booking.service?.durationMinutes ?? 0,
      status: booking.status as string,
      diagnosisName: record.diagnosisName ?? undefined,
      hasPrescription: dto.items.length > 0,
    });
  }

  // LEGACY: Kept for compatibility — delegates to step engine
  async upsertMedicalRecord(
    dto: CreateMedicalRecordDto,
    doctorId: string,
    currentUser?: Express.User,
  ) {
    await this.getVerifiedBooking(dto.bookingId, doctorId, currentUser);

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
      const results = await this.clinicalRepository.findManyIcd10Code({
        take: 10,
        orderBy: { code: 'asc' },
      });
      return ResponseHelper.success(results, 'ICD.SEARCH_SUCCESS', '', 200);
    }
    const results = await this.clinicalRepository.findManyIcd10Code({
      where: {
        OR: [{ code: { contains: query } }, { name: { contains: query } }],
      },
      take: 20,
      orderBy: { code: 'asc' },
    });
    return ResponseHelper.success(results, 'ICD.SEARCH_SUCCESS', '', 200);
  }

  // Patient History
  async getPatientHistory(
    patientProfileId: string,
    page = 1,
    limit = 10,
    currentUser?: Express.User,
  ) {
    await this.validateTreatmentRelation(patientProfileId, currentUser);
    const patientProfile =
      await this.profileRepository.findUniquePatientProfile({
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
      this.clinicalRepository.findManyMedicalRecord({
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
      this.clinicalRepository.countMedicalRecord({
        where: { patientProfileId },
      }),
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
    await this.clinicalRepository.transaction((tx) =>
      this.maybeAdvanceToResultsReady(tx, medicalRecordId),
    );
  }

  // Patient my-visits (self-service)
  async getMyVisits(
    userId: string,
    page = 1,
    limit = 10,
    currentUser?: Express.User,
  ) {
    const patientProfile = await this.profileRepository.findFirstPatientProfile(
      {
        where: { userId },
      },
    );
    if (!patientProfile)
      throw new NotFoundException('Patient profile not found');

    return this.getPatientHistory(patientProfile.id, page, limit, currentUser);
  }

  // Patient visit stats
  async getPatientStats(userId: string, currentUser?: Express.User) {
    const patientProfile = await this.profileRepository.findFirstPatientProfile(
      {
        where: { userId },
      },
    );
    if (!patientProfile)
      throw new NotFoundException('Patient profile not found');

    // Ownership check
    await this.validateTreatmentRelation(patientProfile.id, currentUser);

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [totalVisits, visitsThisYear, activeBookings, abnormalResults] =
      await Promise.all([
        this.clinicalRepository.countMedicalRecord({
          where: { patientProfileId: patientProfile.id },
        }),
        this.clinicalRepository.countMedicalRecord({
          where: {
            patientProfileId: patientProfile.id,
            createdAt: { gte: startOfYear },
          },
        }),
        this.bookingRepository.count({
          where: {
            patientProfileId: patientProfile.id,
            status: {
              in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
            },
          },
        }),
        this.clinicalRepository.countVisitServiceOrder({
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
        this.bookingRepository.count({
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
        this.bookingRepository.count({
          where: {
            doctorId,
            bookingDate: { gte: startOfMonth },
            status: {
              in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'],
            },
          },
        }),
        this.clinicalRepository.countMedicalRecord({ where: { doctorId } }),
        this.bookingRepository.count({
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
