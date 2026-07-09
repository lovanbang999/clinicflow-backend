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
import { Injectable, HttpStatus, Inject, Logger } from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UploadLabResultDto } from './dto/upload-lab-result.dto';
import {
  LabOrderStatus,
  InvoiceStatus,
  User,
  LabResult,
  LabOrder,
  UserRole,
} from '@prisma/client';
import { LabOrdersGateway } from './lab-orders.gateway';
import { BillingService } from '../billing/billing.service';
import { forwardRef } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { MedicalRecordsService } from '../medical-records/medical-records.service';

export interface InternalService {
  id: string;
  name: string;
  labFormType: string;
}

export interface InternalPatientProfile {
  fullName: string;
  patientCode: string | null;
  gender: Gender;
  dateOfBirth: Date | null;
}

export interface InternalBooking {
  id: string;
  bookingCode: string;
  doctorId: string;
  patientProfileId: string;
  doctor: { fullName: string };
  patientProfile: InternalPatientProfile;
}

export interface RawOrderWithRelations {
  id: string;
  bookingId: string;
  testName: string;
  testDescription?: string;
  serviceId?: string;
  status: LabOrderStatus;
  patientProfileId: string;
  service?: {
    id: string;
    name: string;
    labFormType: string;
  };
  booking?: {
    id: string;
    bookingCode: string;
    doctorId: string;
    patientProfileId: string;
    doctor: {
      fullName: string;
      doctorProfile?: {
        specialties: string[];
      };
    };
    patientProfile?: {
      fullName: string;
      patientCode: string | null;
      gender: Gender;
      dateOfBirth: Date | null;
    };
  };
  result?: {
    id: string;
    resultText?: string;
    resultFileUrl?: string;
    isAbnormal?: boolean;
    abnormalNote?: string;
    recordedBy: string;
    resultDate: Date;
  };
  medicalRecord?: {
    id: string;
    chiefComplaint?: string;
    clinicalFindings?: string;
    doctorNotes?: string;
    diagnosisName?: string;
    allergies?: string;
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    spO2?: number;
    weightKg?: number;
    heightCm?: number;
    bmi?: number;
  };
}

export interface InternalLabOrder extends LabOrder {
  result?: LabResult | null;
  service?: InternalService;
  booking?: InternalBooking;
  assignedTechnician?: {
    id: string;
    fullName: string;
    avatar: string | null;
  } | null;
  invoiceItem?: {
    invoice: {
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
    };
  } | null;
}

@Injectable()
export class LabOrdersService {
  private readonly logger = new Logger(LabOrdersService.name);

  constructor(
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly labOrdersGateway: LabOrdersGateway,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  /**
   * Verified if the requester has access to the lab order details.
   */
  private async validateLabOrderAccess(
    patientProfileId: string,
    doctorId: string | undefined,
    currentUser?: Express.User,
  ) {
    if (!currentUser) return; // Internal calls

    if (currentUser.role === 'ADMIN' || currentUser.role === 'TECHNICIAN')
      return;

    if (currentUser.role === 'PATIENT') {
      const profile = await this.profileRepository.findPatientProfileByUserId(
        currentUser.id,
      );
      if (!profile || profile.id !== patientProfileId) {
        throw new ApiException(
          MessageCodes.BOOKING_ACCESS_FORBIDDEN,
          'You can only access your own lab results',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    if (currentUser.role === 'DOCTOR') {
      // Check if they are the assigned doctor OR have a treatment relationship
      if (doctorId === currentUser.id) return;

      const treatmentRelation =
        await this.bookingRepository.hasTreatmentRelationship(
          currentUser.id,
          patientProfileId,
        );

      if (!treatmentRelation) {
        throw new ApiException(
          MessageCodes.BOOKING_ACCESS_FORBIDDEN,
          'You are not authorized to view this patient lab data (No prior treatment relationship)',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    if (currentUser.role === 'RECEPTIONIST') return; // Allow for billing/coordination

    throw new ApiException(
      MessageCodes.BOOKING_ACCESS_FORBIDDEN,
      'Unauthorized access',
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Doctor create lab order

   * Lab order is created with status PENDING (isPaid = false).
   * Receptionist will create a LAB invoice to collect payment, backend automatically seeds items from PENDING orders.
   */
  async createOrder(
    doctorId: string,
    dto: CreateLabOrderDto,
    currentUser?: Express.User,
  ) {
    const booking = await this.bookingRepository.findBookingById(dto.bookingId);

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      booking.doctorId !== doctorId ||
      (currentUser?.role === 'DOCTOR' && booking.doctorId !== currentUser.id)
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Not authorized to access this booking',
        HttpStatus.FORBIDDEN,
      );
    }

    // Ensure medical record exists
    let medicalRecord =
      await this.clinicalRepository.findMedicalRecordByBookingId(dto.bookingId);

    if (!medicalRecord) {
      this.logger.log(
        `Medical record not found for booking: ${dto.bookingId}. Creating new one.`,
      );
      medicalRecord =
        await this.clinicalRepository.createMedicalRecordForBooking(
          dto.bookingId,
          booking.patientProfileId,
          booking.doctorId,
        );
    }

    const labOrder = await this.clinicalRepository.createLabOrderTransaction(
      dto.bookingId,
      booking.patientProfileId,
      booking.doctorId,
      medicalRecord.id,
      medicalRecord.visitStep ?? null,
      dto,
    );

    this.logger.log(
      `Lab order created successfully: ${labOrder.id} for booking: ${dto.bookingId}`,
    );

    // Automatically sync to draft invoice
    try {
      await this.billingService.syncLabInvoice(dto.bookingId);
      this.logger.log(
        `Successfully synced lab invoice for booking: ${dto.bookingId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to sync lab invoice for booking ${dto.bookingId} after creating lab order`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return labOrder;
  }

  async getOrdersByBooking(bookingId: string, currentUser?: Express.User) {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validateLabOrderAccess(
      booking.patientProfileId,
      booking.doctorId,
      currentUser,
    );
    const orders = (await this.clinicalRepository.findLabOrdersByBookingId(
      bookingId,
    )) as unknown as InternalLabOrder[];

    return orders;
  }

  /**
   * Get PENDING lab orders for a booking not yet added to any invoice.
   * Used for receptionist to know when to create a LAB invoice.
   */
  async getPendingUnbilledOrders(
    bookingId: string,
    currentUser?: Express.User,
  ) {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (booking) {
      await this.validateLabOrderAccess(
        booking.patientProfileId,
        booking.doctorId,
        currentUser,
      );
    }
    const orders =
      await this.clinicalRepository.findPendingLabOrdersForBilling(bookingId);
    return orders;
  }

  async getPendingOrders() {
    const rawOrders =
      (await this.clinicalRepository.findPendingLabOrders()) as unknown as InternalLabOrder[];

    const orders = rawOrders.map((order) => {
      const { booking, ...rest } = order;
      if (!booking) return rest;
      return {
        ...rest,
        booking: {
          bookingCode: booking.bookingCode,
          doctor: booking.doctor,
        },
        patientProfile: booking.patientProfile,
      };
    });

    return orders;
  }

  async getOrderById(id: string, currentUser?: Express.User) {
    const rawOrder = (await this.clinicalRepository.findLabOrderWithRelations(
      id,
    )) as unknown as RawOrderWithRelations;

    if (!rawOrder) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Ownership check
    if (rawOrder.booking) {
      await this.validateLabOrderAccess(
        rawOrder.booking.patientProfileId,
        rawOrder.booking.doctorId,
        currentUser,
      );
    }

    // Query recent 3 completed lab orders of same patient and test/service type
    const recentResults =
      await this.clinicalRepository.findRecentCompletedLabOrders(
        rawOrder.patientProfileId,
        rawOrder.id,
        rawOrder.testName,
        rawOrder.serviceId,
      );

    const { booking, ...rest } = rawOrder;
    const order = {
      ...rest,
      booking: booking
        ? {
            bookingCode: booking.bookingCode,
            doctor: {
              fullName: booking.doctor.fullName,
              specialties: booking.doctor.doctorProfile?.specialties || [],
            },
          }
        : undefined,
      patientProfile: booking?.patientProfile,
      recentResults,
    };

    return order;
  }

  /**
   * Technician view list of lab orders that have been paid (PAID) and are ready to perform.
   *
   * Routing logic (3-tier):
   * 1. Hard assigned  → order.assignedTechnicianId === currentUser.id
   * 2. Auto-route     → order.assignedTechnicianId is null AND service.categoryId matches technician specializations
   * 3. Fallback       → order.assignedTechnicianId is null AND technician has no specializations at all
   */
  async getReadyToPerformOrders(currentUser?: Express.User) {
    // Step 1: fetch technician's specialization category IDs
    let technicianCategoryIds: string[] = [];
    let hasSpecializations = false;

    if (currentUser?.role === 'TECHNICIAN') {
      const specializations =
        await this.userRepository.findTechnicianSpecializations(currentUser.id);
      technicianCategoryIds = specializations.map((s) => s.categoryId);
      hasSpecializations = technicianCategoryIds.length > 0;
    }

    const isAdminOrReceptionist =
      !currentUser ||
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'RECEPTIONIST';

    const rawOrders =
      (await this.clinicalRepository.findReadyToPerformLabOrders(
        currentUser?.id,
        technicianCategoryIds,
        hasSpecializations,
        isAdminOrReceptionist,
      )) as unknown as InternalLabOrder[];

    const orders = rawOrders.map((order) => {
      const { booking, ...rest } = order;
      if (!booking) return rest;
      return {
        ...rest,
        booking: { bookingCode: booking.bookingCode, doctor: booking.doctor },
        patientProfile: booking.patientProfile,
      };
    });

    return orders;
  }

  async getTechnicianStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.clinicalRepository.getTechnicianStats(startOfDay, endOfDay);
  }

  async getTechnicianHistory(
    user: User,
    query: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      labFormType?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    let startDate: Date | undefined;
    if (query.startDate) {
      startDate = new Date(query.startDate);
    }
    let endDate: Date | undefined;
    if (query.endDate) {
      endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const [rawOrders, total] =
      await this.clinicalRepository.findTechnicianHistoryPaginated({
        userId: user.id,
        isTechnician: user.role === UserRole.TECHNICIAN,
        startDate,
        endDate,
        categoryId: query.categoryId,
        labFormType: query.labFormType,
        search: query.search,
        skip,
        take: limit,
      });

    const items = rawOrders.map((order) => {
      const { booking, ...rest } = order;
      if (!booking) return rest;
      return {
        ...rest,
        booking: {
          bookingCode: booking.bookingCode,
          doctor: {
            fullName: booking.doctor.fullName,
            specialties: booking.doctor.doctorProfile?.specialties || [],
          },
        },
        patientProfile: booking.patientProfile,
      };
    });

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    };
  }

  async addResult(
    resultAuthorId: string,
    labOrderId: string,
    dto: UploadLabResultDto,
    currentUser?: Express.User,
  ) {
    if (currentUser?.role !== 'TECHNICIAN' && currentUser?.role !== 'ADMIN') {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only technicians or admins can record lab results',
        HttpStatus.FORBIDDEN,
      );
    }
    const order =
      await this.clinicalRepository.findLabOrderWithRelations(labOrderId);

    if (!order) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const updatedOrder =
      await this.clinicalRepository.uploadLabResultTransaction(
        labOrderId,
        resultAuthorId,
        dto,
      );

    this.logger.log(
      `Result added for lab order: ${labOrderId} by user: ${resultAuthorId}`,
    );

    // Push real-time event to the doctor viewing this booking
    try {
      this.labOrdersGateway.broadcastLabResultCompleted(order.bookingId, {
        labOrderId,
        testName: order.testName,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to broadcast lab result completed event: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // CRITICAL: Check if all orders are now done and advance MedicalRecord step
    try {
      await this.medicalRecordsService.checkAndAdvanceToResultsReady(
        order.medicalRecordId,
      );
    } catch (err) {
      this.logger.error(
        `Failed to check and advance medical record step to RESULTS_READY for record ${order.medicalRecordId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return updatedOrder;
  }

  async updateStatus(
    labOrderId: string,
    status: LabOrderStatus,
    currentUser?: User,
  ): Promise<any> {
    if (
      currentUser?.role !== 'TECHNICIAN' &&
      currentUser?.role !== 'ADMIN' &&
      currentUser?.role !== 'RECEPTIONIST' // Receptionists might update status or trigger it
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Action not authorized',
        HttpStatus.FORBIDDEN,
      );
    }
    const order =
      await this.clinicalRepository.findLabOrderWithRelations(labOrderId);

    if (!order) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Guard: Prevent proceeding to IN_PROGRESS if the order is still PENDING (unpaid)
    if (
      status === LabOrderStatus.IN_PROGRESS &&
      order.status === LabOrderStatus.PENDING
    ) {
      throw new ApiException(
        'LAB.ORDER_UNPAID',
        'Cannot perform a lab order that has not been paid.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const updatedOrder = await this.clinicalRepository.updateLabOrderStatus(
      labOrderId,
      status,
    );

    this.logger.log(
      `Lab order ${labOrderId} status updated from ${order.status} to ${status}`,
    );

    if (status === LabOrderStatus.COMPLETED) {
      try {
        await this.medicalRecordsService.checkAndAdvanceToResultsReady(
          order.medicalRecordId,
        );
      } catch (err) {
        this.logger.error(
          `Failed to check and advance medical record step to RESULTS_READY for record ${order.medicalRecordId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return updatedOrder;
  }

  async deleteOrder(
    doctorId: string,
    labOrderId: string,
    currentUser?: Express.User,
  ) {
    const order =
      await this.clinicalRepository.findLabOrderForDeletion(labOrderId);

    if (!order) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      order.doctorId !== doctorId ||
      (currentUser?.role === 'DOCTOR' && order.doctorId !== currentUser.id)
    ) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_DELETE_FORBIDDEN,
        'Only the assigned doctor can delete this order',
        HttpStatus.FORBIDDEN,
      );
    }

    if (order.status === LabOrderStatus.COMPLETED) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_DELETE_COMPLETED,
        'Cannot delete a completed lab order',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Protection: Block deletion if already billed (Invoice is OPEN, PAID, ISSUED, etc.)
    // Only DRAFT invoices allow deletion of items.
    if (order.invoiceItem?.invoice) {
      const invStatus = order.invoiceItem.invoice.status;
      if (invStatus !== InvoiceStatus.DRAFT) {
        throw new ApiException(
          MessageCodes.LAB_ORDER_ALREADY_BILLED,
          'Cannot delete a lab order that has already been billed or paid. Contact receptionist.',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Explicitly remove the invoice item BEFORE deleting the lab order
    // This ensures we clean up the billing side while the link is still active.
    if (order.invoiceItem) {
      try {
        await this.billingService.removeInvoiceItem(
          order.invoiceItem.invoiceId,
          order.invoiceItem.id,
        );
      } catch (err) {
        this.logger.error(
          `Failed to remove invoice item ${order.invoiceItem.id} for lab order ${labOrderId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    await this.clinicalRepository.deleteLabOrderById(labOrderId);

    this.logger.log(
      `Lab order deleted successfully: ${labOrderId} associated with booking: ${order.bookingId}`,
    );

    // Auto-sync after deletion to remove from draft invoice
    try {
      await this.billingService.syncLabInvoice(order.bookingId);
    } catch (err) {
      this.logger.error(
        `Failed to sync lab invoice for booking ${order.bookingId} after deleting lab order`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // CRITICAL: If this was the last pending/active order, advance medical record step
    try {
      await this.medicalRecordsService.checkAndAdvanceToResultsReady(
        order.medicalRecordId,
      );
    } catch (err) {
      this.logger.error(
        `Failed to check and advance medical record step to RESULTS_READY for record ${order.medicalRecordId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return null;
  }
}
