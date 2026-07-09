import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';
import {
  BookingDetail,
  MedicalRecordDetail,
} from '../database/types/prisma-payload.types';
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
  ServiceOrderStatus,
  VisitStep,
  UserRole,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
import { SaveSymptomsDto } from './dto/save-symptoms.dto';
import { CompleteSpecialistExamDto } from './dto/complete-specialist-exam.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { OrderServicesDto } from './dto/order-services.dto';
import { SaveDiagnosisDto } from './dto/save-diagnosis.dto';
import { QueueGateway } from '../queue/queue.gateway';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
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
      const profile = await this.profileRepository.findPatientProfileByUserId(
        currentUser.id,
      );
      if (!profile || profile.id !== patientProfileId) {
        throw new ForbiddenException(
          'You can only access your own medical records',
        );
      }
      return;
    }

    if (currentUser.role === 'DOCTOR') {
      const hasRelation = await this.bookingRepository.hasTreatmentRelationship(
        currentUser.id,
        patientProfileId,
      );

      if (!hasRelation) {
        throw new ForbiddenException(
          'You are not authorized to view this patient history (No prior treatment relationship)',
        );
      }
      return;
    }

    throw new ForbiddenException('Unauthorized access');
  }

  private handlePostAdvanceNotifications(record: MedicalRecordDetail) {
    if (record && record.booking?.doctorId) {
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
        .catch((err) =>
          this.logger.error(
            'Failed to send lab result notification to doctor',
            err instanceof Error ? err.stack : String(err),
          ),
        );

      // Broadcast queue update so doctor's dashboard refreshes
      this.queueGateway.broadcastQueueUpdate(
        record.booking.doctorId,
        'UPDATE',
        {
          bookingId: record.bookingId,
          visitStep: VisitStep.RESULTS_READY,
        },
      );

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
          .catch((err) =>
            this.logger.error(
              'Failed to send lab result notification to patient',
              err instanceof Error ? err.stack : String(err),
            ),
          );
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
    const booking = await this.getVerifiedBooking(
      bookingId,
      doctorId,
      currentUser,
    );

    return this.clinicalRepository.saveSymptomsTransaction(
      bookingId,
      doctorId,
      booking.patientProfileId,
      dto,
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
    const servicesWithDoctors =
      await this.clinicalRepository.findActiveServicesWithDoctors(serviceIds);
    if (servicesWithDoctors.length !== serviceIds.length) {
      throw new BadRequestException(
        'One or more service IDs are invalid or inactive',
      );
    }

    const result = await this.clinicalRepository.orderServicesTransaction(
      bookingId,
      doctorId,
      booking,
      servicesWithDoctors,
      dto.items,
    );

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

    return result;
  }

  // Remove a Service Order (only if PENDING)
  async removeServiceOrder(
    bookingId: string,
    orderId: string,
    doctorId: string,
    currentUser?: Express.User,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId, currentUser);

    const order =
      await this.clinicalRepository.findVisitServiceOrderById(orderId);
    if (!order || order.bookingId !== bookingId)
      throw new NotFoundException('Service order not found');
    if (order.status !== ServiceOrderStatus.PENDING)
      throw new ConflictException(
        'Cannot remove a service order that is already in progress',
      );

    await this.clinicalRepository.deleteVisitServiceOrderById(orderId);

    // Auto-sync after removal
    await this.billingService.syncLabInvoice(bookingId);

    return null;
  }

  // GET Results — composite response for B4
  async getVisitResults(bookingId: string, currentUser?: Express.User) {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    // Ownership check for doctors/patients
    await this.validateTreatmentRelation(booking.patientProfileId, currentUser);
    const record =
      await this.clinicalRepository.findMedicalRecordDetailByBookingId(
        bookingId,
      );

    if (!record) {
      // In early stages of an exam, the record might not exist yet. Return null.
      return null;
    }

    return record;
  }

  // Save Diagnosis
  async saveDiagnosis(
    bookingId: string,
    dto: SaveDiagnosisDto,
    doctorId: string,
    currentUser?: Express.User,
  ) {
    await this.getVerifiedBooking(bookingId, doctorId, currentUser);

    const record =
      await this.clinicalRepository.findMedicalRecordDetailByBookingId(
        bookingId,
        {},
      );
    if (!record)
      throw new NotFoundException(
        'Medical record not found. Complete B1 first.',
      );

    // Guard: can only diagnose when results are ready OR there are no service orders
    const orderCount =
      await this.clinicalRepository.countVisitServiceOrdersByMedicalRecordId(
        record.id,
      );
    const allowedSteps: VisitStep[] = [
      VisitStep.RESULTS_READY,
      VisitStep.DIAGNOSED,
    ];
    if (orderCount > 0 && !allowedSteps.includes(record.visitStep)) {
      throw new BadRequestException(
        `Cannot save diagnosis: visit step is "${record.visitStep}". All service orders must be completed first.`,
      );
    }

    const updated = await this.clinicalRepository.saveDiagnosis(record.id, dto);

    return updated;
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

    const record =
      await this.clinicalRepository.findMedicalRecordDetailByBookingId(
        bookingId,
        {},
      );
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

    const updatedRecord =
      await this.clinicalRepository.savePrescriptionTransaction(
        bookingId,
        doctorId,
        record.id,
        booking.patientProfileId,
        booking.status,
        dto,
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

    return updatedRecord;
  }

  private async sendPostVisitEmailSafe(
    record: { bookingId: string; diagnosisName?: string | null },
    dto: CreatePrescriptionDto,
  ) {
    const booking = await this.bookingRepository.findBookingForPostVisitEmail(
      record.bookingId,
    );
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
            medicineId: i.medicineId,
            unitPrice: i.unitPrice,
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
    return this.clinicalRepository.searchICD10(query);
  }

  // Medicine Search
  async searchMedicines(query: string) {
    return this.clinicalRepository.searchMedicines(query);
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
      await this.profileRepository.findPatientProfileById(patientProfileId);
    if (!patientProfile)
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient not found',
        404,
      );

    const skip = (page - 1) * limit;
    const [visits, total] = await this.clinicalRepository.findPatientHistory(
      patientProfileId,
      skip,
      limit,
    );

    return {
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
      items: visits,
      visits: visits,
      total,
      page,
      limit,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Auto-advance MedicalRecord step (called by VisitServiceOrdersService)
  async checkAndAdvanceToResultsReady(medicalRecordId: string) {
    const result =
      await this.clinicalRepository.checkAndAdvanceToResultsReadyTransaction(
        medicalRecordId,
      );
    if (result.advanced && result.record) {
      this.handlePostAdvanceNotifications(result.record);
    }
  }

  // Patient my-visits (self-service)
  async getMyVisits(
    userId: string,
    page = 1,
    limit = 10,
    currentUser?: Express.User,
  ) {
    const patientProfile =
      await this.profileRepository.findPatientProfileByUserId(userId);
    if (!patientProfile)
      throw new NotFoundException('Patient profile not found');

    return this.getPatientHistory(patientProfile.id, page, limit, currentUser);
  }

  // Patient visit stats
  async getPatientStats(userId: string, currentUser?: Express.User) {
    const patientProfile =
      await this.profileRepository.findPatientProfileByUserId(userId);
    if (!patientProfile)
      throw new NotFoundException('Patient profile not found');

    // Ownership check
    await this.validateTreatmentRelation(patientProfile.id, currentUser);

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [clinicalStats, activeBookings] = await Promise.all([
      this.clinicalRepository.getPatientClinicalStats(
        patientProfile.id,
        startOfYear,
      ),
      this.bookingRepository.countActiveBookingsForPatient(patientProfile.id),
    ]);

    return {
      totalVisits: clinicalStats.totalVisits,
      visitsThisYear: clinicalStats.visitsThisYear,
      activeBookings,
      abnormalResults: clinicalStats.abnormalResults,
    };
  }

  // Doctor stats
  async getDoctorStats(doctorId: string) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    const [bookingStats, clinicalStats] = await Promise.all([
      this.bookingRepository.getDoctorBookingStats(
        doctorId,
        startOfToday,
        endOfToday,
      ),
      this.clinicalRepository.getDoctorClinicalStats(doctorId, startOfToday),
    ]);

    return {
      patientsSeenToday: bookingStats.patientsSeenToday,
      totalPatientsSeen: bookingStats.totalPatientsSeen,
      pendingActive: bookingStats.pendingActive,
      abnormalResultsToday:
        clinicalStats.abnormalLabsToday + clinicalStats.abnormalVsoToday,
    };
  }

  // B8 — Fulfill Prescription (BN mua thuốc tại phòng khám)
  async fulfillPrescription(bookingId: string, pharmacyInvoiceId?: string) {
    const record =
      await this.clinicalRepository.findMedicalRecordDetailByBookingId(
        bookingId,
        { prescription: true },
      );
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

    return this.clinicalRepository.fulfillPrescriptionTransaction(
      prescription.id,
      pharmacyInvoiceId,
    );
  }

  // Specialist Examination Actions
  async startSpecialistExamination(vsoId: string, doctorId: string) {
    const vso = await this.clinicalRepository.findVisitServiceOrderById(vsoId);
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

    let prevBookingStatus: string | undefined;
    if (vso.bookingId) {
      const currentBooking = await this.bookingRepository.findBookingById(
        vso.bookingId,
      );
      prevBookingStatus = currentBooking?.status;
    }

    return this.clinicalRepository.startSpecialistExaminationTransaction(
      vsoId,
      vso.bookingId,
      doctorId,
      prevBookingStatus,
    );
  }

  async completeSpecialistExamination(
    vsoId: string,
    doctorId: string,
    dto: CompleteSpecialistExamDto,
  ) {
    const vso = await this.clinicalRepository.findVisitServiceOrderById(vsoId);
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

    const result =
      await this.clinicalRepository.completeSpecialistExaminationTransaction(
        vsoId,
        {
          ...dto,
          findings: dto.findings as Prisma.InputJsonValue,
        },
      );

    if (result.advanced && result.record) {
      this.handlePostAdvanceNotifications(result.record);
    }

    return result.updatedVso;
  }
}
