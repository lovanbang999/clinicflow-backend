import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../database/interfaces/user.repository.interface';
import { BookingDetail } from '../database/types/prisma-payload.types';
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
  forwardRef,
} from '@nestjs/common';
import {
  LabOrderStatus,
  Prisma,
  ServiceOrderStatus,
  VisitStep,
  UserRole,
  NotificationType,
  PerformerType,
} from '@prisma/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
import { SaveSymptomsDto } from './dto/save-symptoms.dto';
import { CompleteSpecialistExamDto } from './dto/complete-specialist-exam.dto';
import { BookingStatus } from '@prisma/client';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { OrderServicesDto } from './dto/order-services.dto';
import { SaveDiagnosisDto } from './dto/save-diagnosis.dto';
import { QueueGateway } from '../queue/queue.gateway';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  private readonly visitIncludes = {
    visitServiceOrders: {
      include: { service: true, performer: true },
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
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
    private readonly queueGateway: QueueGateway,
  ) {}

  // PRIVATE HELPERS
  private async getVerifiedBooking(
    bookingId: string,
    doctorId: string,
    currentUser?: Express.User,
  ): Promise<BookingDetail> {
    const booking = await this.bookingRepository.findBookingById(bookingId);
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
              'AWAITING_RESULTS',
              'COMPLETED',
              'PENDING',
              'CANCELLED', // Allow viewing history even if cancelled later
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

  /** Auto-check if all VisitServiceOrders and LabOrders for a record are COMPLETED → advance step */
  private async maybeAdvanceToResultsReady(
    tx: Prisma.TransactionClient,
    medicalRecordId: string,
  ) {
    const allVso = await tx.visitServiceOrder.findMany({
      where: { medicalRecordId },
      select: { status: true },
    });

    const allLabs = await tx.labOrder.findMany({
      where: { medicalRecordId },
      select: { status: true },
    });

    if (allVso.length === 0 && allLabs.length === 0) return;

    const allVsoDone = allVso.every(
      (o) =>
        o.status === ServiceOrderStatus.COMPLETED ||
        o.status === ServiceOrderStatus.CANCELLED,
    );
    const allLabsDone = allLabs.every(
      (o) =>
        o.status === LabOrderStatus.COMPLETED ||
        o.status === LabOrderStatus.CANCELLED,
    );

    const record = await tx.medicalRecord.findUnique({
      where: { id: medicalRecordId },
      include: {
        booking: {
          include: { patientProfile: true },
        },
      },
    });

    this.logger.log(
      `Checking advancement for record ${medicalRecordId}: allVsoDone=${allVsoDone}, allLabsDone=${allLabsDone}, currentStep=${record?.visitStep}`,
    );

    if (allVsoDone && allLabsDone) {
      // Advance step if we are in SERVICES_ORDERED or AWAITING_RESULTS phase
      const allowedSteps: VisitStep[] = [
        VisitStep.SERVICES_ORDERED,
        VisitStep.AWAITING_RESULTS,
      ];

      if (record && allowedSteps.includes(record.visitStep)) {
        this.logger.log(`Advancing record ${medicalRecordId} to RESULTS_READY`);
        await tx.medicalRecord.update({
          where: { id: medicalRecordId },
          data: {
            visitStep: VisitStep.RESULTS_READY,
            version: { increment: 1 },
          },
        });

        // Notify doctor if possible
        if (record.booking?.doctorId) {
          this.notificationsService
            .createInAppNotification({
              userId: record.booking.doctorId,
              title: 'Kết quả khám/CLS đã có',
              content: `Bệnh nhân ${record.booking.patientProfile?.fullName ?? '...'} đã hoàn tất các chỉ định. Bạn có thể chẩn đoán.`,
              type: NotificationType.LAB_RESULT_READY,
              metadata: {
                bookingId: record.bookingId,
                recordId: record.id,
              },
            })
            .catch(console.error);

          // Broadcast queue update so doctor's dashboard refreshes
          this.queueGateway.broadcastQueueUpdate(record.doctorId, 'UPDATE', {
            bookingId: record.bookingId,
            visitStep: VisitStep.RESULTS_READY,
          });

          // Notify Patient
          if (record.booking?.patientProfile?.userId) {
            this.notificationsService
              .createInAppNotification({
                userId: record.booking.patientProfile.userId,
                title: 'Kết quả CLS đã có',
                content: `Tất cả kết quả xét nghiệm của bạn đã có. Vui lòng quay lại phòng khám gặp bác sĩ.`,
                type: NotificationType.LAB_RESULT_READY,
                metadata: { bookingId: record.bookingId },
              })
              .catch(console.error);
          }
        }
      }
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
          followUpNote: dto.followUpNote,
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
          followUpNote: dto.followUpNote,
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

    const serviceIds = dto.items.map((i) => i.serviceId);

    // Validate services exist and load doctorServices associations
    const servicesWithDoctors = await this.clinicalRepository.transaction(
      async (tx) =>
        tx.service.findMany({
          where: { id: { in: serviceIds }, isActive: true },
          include: {
            doctorServices: {
              include: {
                doctorProfile: {
                  include: { user: { select: { id: true } } },
                },
              },
              take: 1, // Take the first assigned specialist
            },
          },
        }),
    );
    if (servicesWithDoctors.length !== serviceIds.length) {
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
      const newItems = dto.items.filter((i) => !existingIds.has(i.serviceId));

      if (newItems.length > 0) {
        for (const item of newItems) {
          const serviceId = item.serviceId;
          const svc = servicesWithDoctors.find((s) => s.id === serviceId);
          if (!svc) continue;

          if (svc.performerType === PerformerType.TECHNICIAN) {
            // Create LabOrder for Technicians
            await tx.labOrder.create({
              data: {
                medicalRecordId: record.id,
                serviceId,
                patientProfileId: booking.patientProfileId,
                bookingId,
                doctorId: booking.doctorId, // Doctor who ordered it
                testName: svc.name,
                status: LabOrderStatus.PENDING,
              },
            });
          } else {
            // Create VisitServiceOrder for Specialists (Doctors)
            // Priority: 1. Directly assigned in DTO -> 2. First specialist in association -> 3. Null
            const specialistUserId =
              item.performedBy ??
              svc?.doctorServices?.[0]?.doctorProfile?.user?.id ??
              null;

            await tx.visitServiceOrder.create({
              data: {
                medicalRecordId: record.id,
                serviceId,
                patientProfileId: booking.patientProfileId,
                bookingId,
                orderedBy: doctorId,
                performedBy: specialistUserId,
                status: ServiceOrderStatus.PENDING,
              },
            });
          }
        }
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

      const vsoOrders = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: record.id },
        include: { service: true },
      });

      const labOrders = await tx.labOrder.findMany({
        where: { medicalRecordId: record.id },
        include: { service: true },
      });

      return { record: updated, orders: vsoOrders, labOrders };
    });

    // Auto-sync to draft invoice
    await this.billingService.syncLabInvoice(bookingId);

    // Notify Receptionist & Patient
    const patientName = booking.patientProfile?.fullName ?? 'Bệnh nhân';
    await this.notificationsService.notifyRole({
      role: UserRole.RECEPTIONIST,
      title: 'Chỉ định CLS mới',
      content: `Bệnh nhân ${patientName} có chỉ định CLS mới. Vui lòng thu phí tại quầy.`,
      type: NotificationType.SYSTEM,
      metadata: { bookingId },
    });

    if (booking.patientProfile?.userId) {
      await this.notificationsService.createInAppNotification({
        userId: booking.patientProfile.userId,
        title: 'Chỉ định mới từ Bác sĩ',
        content: `Bác sĩ đã chỉ định các dịch vụ CLS. Vui lòng di chuyển ra quầy lễ tân để thanh toán.`,
        type: NotificationType.SYSTEM,
        metadata: { bookingId },
      });
    }

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

      // Notify Receptionist/Pharmacy
      const patientName =
        updatedRecord.booking?.patientProfile?.fullName ?? 'Bệnh nhân';
      await this.notificationsService.notifyRole({
        role: UserRole.RECEPTIONIST,
        title: 'Có đơn thuốc mới',
        content: `Bệnh nhân ${patientName} đã hoàn tất buổi khám và có đơn thuốc. Vui lòng chuẩn bị thuốc.`,
        type: NotificationType.SYSTEM,
        metadata: { bookingId: updatedRecord.bookingId },
      });
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

    const [
      patientsSeenToday,
      totalPatientsSeen,
      pendingActive,
      abnormalLabs,
      abnormalVso,
    ] = await Promise.all([
      this.bookingRepository.count({
        where: {
          doctorId,
          bookingDate: {
            gte: startOfToday,
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
          },
          status: 'COMPLETED',
        },
      }),
      this.bookingRepository.count({
        where: {
          doctorId,
          status: 'COMPLETED',
        },
      }),
      this.bookingRepository.count({
        where: {
          doctorId,
          status: {
            in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'AWAITING_RESULTS'],
          },
        },
      }),
      this.clinicalRepository.countLabOrder({
        where: {
          doctorId,
          result: {
            isAbnormal: true,
            createdAt: { gte: startOfToday },
          },
        },
      }),
      this.clinicalRepository.countVisitServiceOrder({
        where: {
          orderedBy: doctorId,
          isAbnormal: true,
          completedAt: { gte: startOfToday },
        },
      }),
    ]);

    return ResponseHelper.success(
      {
        patientsSeenToday,
        totalPatientsSeen,
        pendingActive,
        abnormalResultsToday: abnormalLabs + abnormalVso,
      },
      'DOCTOR.STATS_RETRIEVED',
      'Doctor stats retrieved',
      200,
    );
  }

  // B8 — Fulfill Prescription (BN mua thuốc tại phòng khám)
  async fulfillPrescription(bookingId: string, pharmacyInvoiceId?: string) {
    const record = await this.clinicalRepository.findUniqueMedicalRecord({
      where: { bookingId },
      include: { prescription: true },
    });
    if (!record) {
      throw new NotFoundException('Medical record not found');
    }
    const prescription = record.prescription;
    if (!prescription) {
      throw new NotFoundException(
        'Prescription not found. Doctor has not issued a prescription yet.',
      );
    }
    if (prescription.isFulfilledInternally === true) {
      throw new BadRequestException(
        'Prescription is already fulfilled internally.',
      );
    }

    const updated = await this.clinicalRepository.transaction(async (tx) => {
      return tx.prescription.update({
        where: { id: prescription.id },
        data: {
          isFulfilledInternally: true,
          fulfilledAt: new Date(),
          ...(pharmacyInvoiceId ? { pharmacyInvoiceId } : {}),
        },
      });
    });

    return ResponseHelper.success(
      updated,
      'PRESCRIPTION.FULFILLED',
      'Prescription marked as fulfilled internally',
      200,
    );
  }

  // Specialist Examination Actions
  async startSpecialistExamination(vsoId: string, doctorId: string) {
    const vso = await this.clinicalRepository.findUniqueVisitServiceOrder({
      where: { id: vsoId },
    });
    if (!vso) throw new NotFoundException('Service order not found');

    if (vso.performedBy !== doctorId) {
      throw new ForbiddenException(
        'You are not assigned to perform this service',
      );
    }

    if (vso.status !== ServiceOrderStatus.PAID) {
      throw new BadRequestException(
        'Service must be paid before starting examination',
      );
    }

    const updated = await this.clinicalRepository.transaction(async (tx) => {
      // 1. Update VSO to IN_PROGRESS
      const updatedVso = await tx.visitServiceOrder.update({
        where: { id: vsoId },
        data: { status: ServiceOrderStatus.IN_PROGRESS },
      });

      // 2. Update Booking to AWAITING_RESULTS (Consultation doctor knows patient is being seen)
      if (vso.bookingId) {
        await tx.booking.update({
          where: { id: vso.bookingId },
          data: { status: BookingStatus.AWAITING_RESULTS },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: vso.bookingId,
            oldStatus: BookingStatus.CHECKED_IN, // Assuming they were checked-in/waiting
            newStatus: BookingStatus.AWAITING_RESULTS,
            changedById: doctorId,
            reason: 'Specialist examination started',
          },
        });
      }

      return updatedVso;
    });

    return ResponseHelper.success(
      updated,
      'VSO.STARTED',
      'Specialist examination started',
      200,
    );
  }

  async completeSpecialistExamination(
    vsoId: string,
    doctorId: string,
    dto: CompleteSpecialistExamDto,
  ) {
    const vso = await this.clinicalRepository.findUniqueVisitServiceOrder({
      where: { id: vsoId },
    });
    if (!vso) throw new NotFoundException('Service order not found');

    if (vso.performedBy !== doctorId) {
      throw new ForbiddenException(
        'You are not assigned to perform this service',
      );
    }

    const validStatuses: string[] = [
      ServiceOrderStatus.PAID,
      ServiceOrderStatus.IN_PROGRESS,
    ];
    if (!validStatuses.includes(vso.status)) {
      throw new BadRequestException(
        'Invalid order status for recording results',
      );
    }

    const updated = await this.clinicalRepository.transaction(async (tx) => {
      const updatedVso = await tx.visitServiceOrder.update({
        where: { id: vsoId },
        data: {
          status: ServiceOrderStatus.COMPLETED,
          resultText: dto.resultText,
          specialistNote: dto.doctorNotes,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          findings: dto.findings as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      await this.maybeAdvanceToResultsReady(tx, vso.medicalRecordId);

      return updatedVso;
    });

    return ResponseHelper.success(
      updated,
      'VSO.COMPLETED',
      'Specialist examination result recorded successfully',
      200,
    );
  }
}
