import {
  Injectable,
  HttpStatus,
  forwardRef,
  Inject,
  Logger,
} from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import {
  CreateInvoiceDto,
  AddInvoiceItemDto,
  ConfirmPaymentDto,
} from './dto/billing.dto';
import {
  IFinanceRepository,
  I_FINANCE_REPOSITORY,
  InvoiceDetailResult,
  InvoiceWithBooking,
  InvoiceDetailForPaymentResult,
  InvoiceDetailPostPaymentResult,
  InvoiceDetailForFinalizeResult,
} from '../database/interfaces/finance.repository.interface';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../database/interfaces/booking.repository.interface';
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../database/interfaces/profile.repository.interface';
import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';

import {
  InvoiceStatus,
  InvoiceType,
  BookingStatus,
  VisitStep,
  BookingPriority,
  User,
  Invoice,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { LabOrdersGateway } from '../lab-orders/lab-orders.gateway';
import { QueueGateway } from '../queue/queue.gateway';
import { format } from 'date-fns';
import { QueueService } from '../queue/queue.service';
import { SequenceService } from '../database/services/sequence.service';

@Injectable()
export class BillingService {
  constructor(
    @Inject(I_FINANCE_REPOSITORY)
    private readonly financeRepository: IFinanceRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => LabOrdersGateway))
    private readonly labOrdersGateway: LabOrdersGateway,
    private readonly queueGateway: QueueGateway,
    private readonly queueService: QueueService,
    private readonly sequenceService: SequenceService,
  ) {}

  private readonly logger = new Logger(BillingService.name);

  private formatVNCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  /**
   * Verified if the requester has access to the invoice details.
   */
  private async validateInvoiceAccess(
    patientProfileId: string,
    currentUser?: Express.User,
  ) {
    if (!currentUser) return; // Internal calls

    if (currentUser.role === 'ADMIN' || currentUser.role === 'RECEPTIONIST')
      return;

    if (currentUser.role === 'PATIENT') {
      const profile = await this.profileRepository.findPatientProfileByUserId(
        currentUser.id,
      );
      if (!profile || profile.id !== patientProfileId) {
        throw new ApiException(
          MessageCodes.BOOKING_ACCESS_FORBIDDEN,
          'You can only access your own invoices',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    if (currentUser.role === 'DOCTOR') {
      // Check for a treatment relationship
      const treatmentRelation =
        await this.bookingRepository.findTreatmentRelationship(
          currentUser.id,
          patientProfileId,
        );

      if (!treatmentRelation) {
        throw new ApiException(
          MessageCodes.BOOKING_ACCESS_FORBIDDEN,
          'You are not authorized to view this patient billing data (No prior treatment relationship)',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    throw new ApiException(
      MessageCodes.BOOKING_ACCESS_FORBIDDEN,
      'Unauthorized access',
      HttpStatus.FORBIDDEN,
    );
  }

  // Invoice CRUD

  /**
   * Create a DRAFT invoice for a booking.
   * A booking can have multiple invoices (Consultation / Lab / Pharmacy).
   * Auto-seeds a first line item from the booking's service (for CONSULTATION type).
   */
  async createInvoice(
    dto: CreateInvoiceDto,
    currentUser?: Express.User,
  ): Promise<Invoice> {
    if (
      currentUser &&
      currentUser.role !== 'ADMIN' &&
      currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only receptionists and admins can create invoices',
        HttpStatus.FORBIDDEN,
      );
    }
    const booking = await this.bookingRepository.findBookingForInvoiceCreation(
      dto.bookingId,
    );

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const invoiceType = dto.invoiceType ?? InvoiceType.CONSULTATION;
    const servicePrice = booking.service?.price ?? 0;

    // Guard: PHARMACY invoice can only be created on the same day as the booking
    if (invoiceType === InvoiceType.PHARMACY) {
      const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
      const nowVN = new Date(Date.now() + VN_OFFSET_MS);
      const todayUTC = new Date(
        Date.UTC(
          nowVN.getUTCFullYear(),
          nowVN.getUTCMonth(),
          nowVN.getUTCDate(),
        ),
      );
      // bookingDate is stored as UTC midnight of the Vietnam local date
      const bookingDayUTC = new Date(
        Date.UTC(
          new Date(booking.bookingDate).getUTCFullYear(),
          new Date(booking.bookingDate).getUTCMonth(),
          new Date(booking.bookingDate).getUTCDate(),
        ),
      );
      if (bookingDayUTC.getTime() !== todayUTC.getTime()) {
        throw new ApiException(
          'BILLING.PHARMACY_INVOICE_EXPIRED',
          'Invoice PHARMACY can only be created on the same day as the booking. Please ask the patient to buy medicine outside.',
          HttpStatus.CONFLICT,
        );
      }
      // Guard: must have a COMPLETED booking to issue PHARMACY invoice
      if (booking.status !== 'COMPLETED') {
        throw new ApiException(
          'BILLING.PHARMACY_REQUIRES_COMPLETED',
          'Invoice PHARMACY can only be created after the doctor completes the examination (booking COMPLETED).',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${dateStr}-`;
    const count = await this.sequenceService.generateNextSequence(prefix);
    const invoiceNumber = `${prefix}${String(count).padStart(4, '0')}`;

    const result = await this.financeRepository.createInvoiceTransaction({
      bookingId: dto.bookingId,
      patientProfileId: booking.patientProfileId,
      invoiceType,
      invoiceNumber,
      notes: dto.notes,
      servicePrice: Number(servicePrice),
      bookingService: booking.service
        ? { id: booking.service.id, name: booking.service.name }
        : null,
      labOrderIds: dto.labOrderIds,
      visitServiceOrderIds: dto.visitServiceOrderIds,
      items: dto.items,
    });

    return result;
  }

  async deleteInvoice(id: string, currentUser?: Express.User) {
    if (
      currentUser &&
      currentUser.role !== 'ADMIN' &&
      currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only receptionists and admins can delete invoices',
        HttpStatus.FORBIDDEN,
      );
    }
    const invoice = await this.financeRepository.findInvoiceById(id);
    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_DRAFT,
        'Only DRAFT invoices can be deleted.',
        HttpStatus.CONFLICT,
      );
    }

    await this.financeRepository.deleteInvoiceById(id);
    return null;
  }

  async syncLabInvoice(
    bookingId: string,
  ): Promise<InvoiceDetailResult | Invoice | null> {
    const invoice = await this.financeRepository.findDraftInvoiceByType(
      bookingId,
      InvoiceType.SERVICE,
    );

    const pendingLabs =
      await this.clinicalRepository.findPendingLabsForSync(bookingId);

    const pendingVsos =
      await this.clinicalRepository.findPendingVsosForSync(bookingId);

    if (pendingLabs.length === 0 && pendingVsos.length === 0 && !invoice) {
      return null;
    }

    if (!invoice) {
      const result = await this.createInvoice({
        bookingId,
        invoiceType: InvoiceType.SERVICE,
      });
      this.labOrdersGateway.server.emit('billing_list_refresh', { bookingId });
      return result;
    }

    const { deleted } = await this.financeRepository.syncLabInvoiceTransaction({
      invoiceId: invoice.id,
      pendingLabs: pendingLabs.map((order) => ({
        id: order.id,
        testName: order.testName,
        service: order.service ? { price: order.service.price } : null,
      })),
      pendingVsos: pendingVsos.map((vso) => ({
        id: vso.id,
        service: vso.service
          ? { price: vso.service.price, name: vso.service.name }
          : null,
      })),
    });

    if (deleted) {
      this.labOrdersGateway.server.emit('billing_list_refresh', { bookingId });
      return null;
    }

    this.labOrdersGateway.server.emit('billing_list_refresh', { bookingId });
    return this.getInvoiceById(invoice.id);
  }

  /**
   * List all invoices for a booking (multiple invoices per booking).
   */
  async listInvoicesByBooking(
    bookingId: string,
    currentUser?: Express.User,
  ): Promise<InvoiceWithBooking[]> {
    const booking =
      await this.bookingRepository.findBookingPatientProfileId(bookingId);
    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validateInvoiceAccess(booking.patientProfileId, currentUser);

    const invoices: InvoiceWithBooking[] =
      await this.financeRepository.findInvoicesByBookingId(bookingId);

    return invoices;
  }

  // Get invoice by invoice ID.
  async getInvoiceById(
    id: string,
    currentUser?: Express.User,
  ): Promise<InvoiceDetailResult> {
    const invoice: InvoiceDetailResult | null =
      await this.financeRepository.findInvoiceDetailById(id);

    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validateInvoiceAccess(invoice.patientProfileId, currentUser);

    return invoice;
  }

  /**
   * List invoices with optional filters (status, patientProfileId, invoiceType, date range).
   */
  async listInvoices(params: {
    status?: InvoiceStatus;
    patientProfileId?: string;
    invoiceType?: InvoiceType;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
    currentUser?: Express.User;
  }): Promise<{
    items: InvoiceWithBooking[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (
      params.currentUser &&
      params.currentUser.role !== 'ADMIN' &&
      params.currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Unauthorized access to financial records',
        HttpStatus.FORBIDDEN,
      );
    }
    const {
      status,
      patientProfileId,
      invoiceType,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = params;
    const skip = (page - 1) * limit;

    const { items, total }: { items: InvoiceWithBooking[]; total: number } =
      await this.financeRepository.findInvoicesPaginated({
        status,
        patientProfileId,
        invoiceType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        search,
        skip,
        take: limit,
      });

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async exportInvoicesToCsv(params: {
    status?: InvoiceStatus;
    invoiceType?: InvoiceType;
    patientProfileId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    currentUser?: User;
  }) {
    if (
      params.currentUser &&
      params.currentUser.role !== 'ADMIN' &&
      params.currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Unauthorized access to financial records',
        HttpStatus.FORBIDDEN,
      );
    }
    const {
      status,
      patientProfileId,
      invoiceType,
      startDate,
      endDate,
      search,
    } = params;

    const invoices: InvoiceWithBooking[] =
      await this.financeRepository.findInvoicesForExport({
        status,
        patientProfileId,
        invoiceType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        search,
      });

    const escapeCsv = (
      val:
        | string
        | number
        | boolean
        | Date
        | null
        | undefined
        | { toString(): string },
    ) => {
      if (val === null || val === undefined) return '';
      const str =
        typeof val === 'object' && val !== null ? val.toString() : String(val);
      if (
        str.includes(',') ||
        str.includes('"') ||
        str.includes('\n') ||
        str.includes('\r')
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const translateInvoiceType = (type: InvoiceType) => {
      switch (type) {
        case InvoiceType.CONSULTATION:
          return 'Khám bệnh/Tư vấn';
        case InvoiceType.SERVICE:
          return 'Dịch vụ/Xét nghiệm';
        case InvoiceType.PHARMACY:
          return 'Dược phẩm';
        default:
          return type;
      }
    };

    const translateInvoiceStatus = (status: InvoiceStatus) => {
      switch (status) {
        case InvoiceStatus.DRAFT:
          return 'Nháp';
        case InvoiceStatus.OPEN:
          return 'Chờ thanh toán';
        case InvoiceStatus.ISSUED:
          return 'Chờ thanh toán (Đã phát hành)';
        case InvoiceStatus.PAID:
          return 'Đã thanh toán';
        case InvoiceStatus.CANCELLED:
          return 'Đã hủy';
        case InvoiceStatus.REFUNDED:
          return 'Đã hoàn tiền';
        default:
          return status;
      }
    };

    const headers = [
      'Mã hóa đơn',
      'Mã lịch hẹn',
      'Tên bệnh nhân',
      'Mã bệnh nhân',
      'Loại hóa đơn',
      'Tổng tiền (VND)',
      'Đã thanh toán (VND)',
      'Trạng thái',
      'Ngày thanh toán',
    ];

    const rows = invoices.map((invoice) => {
      const paidAmount =
        invoice.status === 'PAID'
          ? Number(invoice.totalAmount)
          : invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);

      const paidAtStr = invoice.paidAt
        ? format(new Date(invoice.paidAt), 'dd/MM/yyyy HH:mm')
        : '';

      return [
        invoice.invoiceNumber,
        invoice.booking?.bookingCode || '',
        invoice.booking?.patientProfile?.fullName || '',
        invoice.booking?.patientProfile?.patientCode || '',
        translateInvoiceType(invoice.invoiceType),
        Number(invoice.totalAmount),
        paidAmount,
        translateInvoiceStatus(invoice.status),
        paidAtStr,
      ].map(escapeCsv);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');
    return csvContent;
  }

  /**
   * Get PENDING lab orders of a booking that are not yet added to any invoice.
   * Used by receptionist to know if they need to create a LAB invoice.
   */
  async getPendingLabOrdersForBilling(bookingId: string) {
    const orders =
      await this.clinicalRepository.findPendingLabOrdersForBilling(bookingId);

    return orders;
  }

  // Invoice Items

  /**
   * Add an extra line item to a DRAFT invoice (e.g. additional services).
   */
  async addInvoiceItem(
    invoiceId: string,
    dto: AddInvoiceItemDto,
    currentUser?: Express.User,
  ) {
    if (
      currentUser &&
      currentUser.role !== 'ADMIN' &&
      currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only receptionists and admins can modify invoices',
        HttpStatus.FORBIDDEN,
      );
    }
    const invoice = await this.financeRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.OPEN
    ) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_DRAFT,
        'Can only add items to DRAFT or OPEN invoice',
        HttpStatus.CONFLICT,
      );
    }

    const quantity = dto.quantity ?? 1;
    const totalPrice = dto.unitPrice * quantity;

    const item = await this.financeRepository.addInvoiceItemTransaction({
      invoiceId,
      item: dto,
      quantity,
      totalPrice,
    });

    return item;
  }

  /**
   * Remove a line item from a DRAFT invoice.
   */
  async removeInvoiceItem(
    invoiceId: string,
    itemId: string,
    currentUser?: Express.User,
  ) {
    if (
      currentUser &&
      currentUser.role !== 'ADMIN' &&
      currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only receptionists and admins can modify invoices',
        HttpStatus.FORBIDDEN,
      );
    }
    const invoice = await this.financeRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.OPEN
    ) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_DRAFT,
        'Can only remove items from DRAFT or OPEN invoice',
        HttpStatus.CONFLICT,
      );
    }

    await this.financeRepository.removeInvoiceItemTransaction(
      invoiceId,
      itemId,
    );

    return null;
  }

  // Payment Confirmation

  /**
   * Add a payment to an invoice.
   * - DRAFT → OPEN on first payment.
   * - Auto-finalizes (OPEN → PAID) when total payments ≥ totalAmount.
   * - If dto.labOrderId is provided, marks the LabOrder as PAID.
   */
  async addPayment(
    invoiceId: string,
    dto: ConfirmPaymentDto,
    confirmedByUserId: string,
    currentUser?: Express.User,
  ): Promise<InvoiceDetailPostPaymentResult | null> {
    if (
      currentUser &&
      currentUser.role !== 'ADMIN' &&
      currentUser.role !== 'RECEPTIONIST'
    ) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only receptionists and admins can confirm payments',
        HttpStatus.FORBIDDEN,
      );
    }
    const invoice: InvoiceDetailForPaymentResult | null =
      await this.financeRepository.findInvoiceDetailForPayment(invoiceId);

    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ApiException(
        MessageCodes.INVOICE_ALREADY_PAID,
        'Invoice is already finalized and PAID',
        HttpStatus.CONFLICT,
      );
    }

    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.REFUNDED
    ) {
      throw new ApiException(
        MessageCodes.PAYMENT_FAILED,
        'Cannot add payment to a cancelled or refunded invoice',
        HttpStatus.FORBIDDEN,
      );
    }

    if (invoice.invoiceType === InvoiceType.CONSULTATION) {
      const isAwaitingResults = invoice.booking?.status === 'AWAITING_RESULTS';
      const isCompleted = invoice.booking?.status === 'COMPLETED';
      const visitStep = invoice.booking?.medicalRecord?.visitStep;

      const allowedSteps: VisitStep[] = [
        VisitStep.SERVICES_ORDERED,
        VisitStep.AWAITING_RESULTS,
        VisitStep.RESULTS_READY,
        VisitStep.DIAGNOSED,
        VisitStep.PRESCRIBED,
        VisitStep.COMPLETED,
      ];

      if (
        !isAwaitingResults &&
        !isCompleted &&
        !(visitStep && allowedSteps.includes(visitStep))
      ) {
        throw new ApiException(
          'BILLING.CONSULTATION_NOT_COMPLETED',
          'Only consultation fees can be paid after the consultation (Phase 1) is completed or advanced.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const insuranceCovered = dto.insuranceCovered ?? 0;

    if (insuranceCovered > dto.amountPaid) {
      throw new ApiException(
        'BILLING.INSURANCE_EXCEEDS_PAYMENT',
        'Insurance covered amount cannot exceed the total amount paid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const patientPaid = dto.amountPaid - insuranceCovered;

    // Calculate total paid after this payment
    const previouslyPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amountPaid),
      0,
    );
    const newTotalPaid = previouslyPaid + dto.amountPaid;
    const invoiceTotal = Number(invoice.totalAmount);
    const shouldAutoFinalize = newTotalPaid >= invoiceTotal;

    const technicians = await this.bookingRepository.findTechnicians();

    const { paidVsoIds, broadcastPayload } =
      await this.financeRepository.addPaymentTransaction({
        invoiceId,
        input: dto,
        confirmedByUserId,
        previouslyPaid,
        invoiceTotal,
        shouldAutoFinalize,
        patientPaid,
        insuranceCovered,
        invoiceType: invoice.invoiceType,
        invoiceBookingId: invoice.bookingId,
        currentBookingStatus: invoice.booking?.status,
        invoicePatientProfileUserId: invoice.booking?.patientProfile?.userId,
        invoicePatientProfileFullName:
          invoice.booking?.patientProfile?.fullName,
        technicians,
        generateQueueNumber: async (prefix: string) => {
          return this.sequenceService.generateNextSequence(prefix);
        },
        onQueueAdd: async () => {
          if (invoice.booking?.serviceId && invoice.booking?.doctorId) {
            await this.queueService.addToQueue(
              invoice.bookingId,
              confirmedByUserId,
            );
          }
        },
      });

    // Broadcast WebSocket event AFTER transaction successfully commits
    if (broadcastPayload) {
      this.labOrdersGateway.broadcastNewLabOrder(broadcastPayload);
    }

    // Broadcast queue updates to each specialist doctor who has a PAID VSO
    if (paidVsoIds.length > 0) {
      const uniqueDoctorIds =
        await this.clinicalRepository.findPaidVsoPerformers(paidVsoIds);

      for (const docId of uniqueDoctorIds) {
        this.queueGateway.broadcastQueueUpdate(docId, 'CHECK_IN', {
          source: 'specialist_referral',
          invoiceId,
        });
      }
    }

    const updated: InvoiceDetailPostPaymentResult | null =
      await this.financeRepository.findInvoiceDetailPostPayment(invoiceId);

    // Send invoice email if finalized
    if (shouldAutoFinalize && updated?.booking?.patientProfile?.user?.email) {
      this.notificationsService
        .sendInvoiceEmail({
          patientId: updated.booking.patientProfile.userId ?? undefined,
          patientName: updated.booking.patientProfile.fullName,
          patientEmail: updated.booking.patientProfile.user.email,
          invoiceNumber: updated.invoiceNumber,
          invoiceDate: format(updated.createdAt, 'dd/MM/yyyy'),
          invoiceType: updated.invoiceType,
          totalAmount: this.formatVNCurrency(Number(updated.totalAmount)),
          invoiceUrl: `${process.env.FRONTEND_URL}/patient/billing/${updated.id}`,
        })
        .catch((err) =>
          this.logger.error(
            'Failed to send invoice email',
            err instanceof Error ? err.stack : String(err),
          ),
        );
    }

    return updated;
  }

  /**
   * Manually finalize the invoice (ISSUED/OPEN → PAID).
   * Normally called automatically by addPayment when total is met.
   */
  async finalizeInvoice(
    invoiceId: string,
  ): Promise<InvoiceDetailPostPaymentResult> {
    const invoice: InvoiceDetailForFinalizeResult | null =
      await this.financeRepository.findInvoiceDetailForFinalize(invoiceId);

    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ApiException(
        MessageCodes.INVOICE_ALREADY_PAID,
        'Invoice is already finalized',
        HttpStatus.CONFLICT,
      );
    }

    // Calculate sum of all payments
    const totalInsurance = invoice.payments.reduce(
      (sum, p) => sum + Number(p.insuranceCovered),
      0,
    );
    const totalPatient = invoice.payments.reduce(
      (sum, p) => sum + Number(p.patientPaid),
      0,
    );

    const updatedInvoice: InvoiceDetailPostPaymentResult =
      await this.financeRepository.finalizeInvoiceStatus(
        invoiceId,
        totalInsurance,
        totalPatient,
      );

    // Send invoice email
    if (updatedInvoice?.booking?.patientProfile?.user?.email) {
      this.notificationsService
        .sendInvoiceEmail({
          patientId: updatedInvoice.booking.patientProfile.userId ?? undefined,
          patientName: updatedInvoice.booking.patientProfile.fullName,
          patientEmail: updatedInvoice.booking.patientProfile.user.email,
          invoiceNumber: updatedInvoice.invoiceNumber,
          invoiceDate: format(updatedInvoice.createdAt, 'dd/MM/yyyy'),
          invoiceType: updatedInvoice.invoiceType,
          totalAmount: this.formatVNCurrency(
            Number(updatedInvoice.totalAmount),
          ),
          invoiceUrl: `${process.env.FRONTEND_URL}/patient/billing/${updatedInvoice.id}`,
        })
        .catch((err) =>
          this.logger.error(
            'Failed to send invoice email',
            err instanceof Error ? err.stack : String(err),
          ),
        );
    }

    // Notify admins of payment
    const patientName =
      updatedInvoice.booking?.patientProfile?.fullName || 'Khách';
    await this.notificationsService.notifyAdmins({
      title: 'Thanh toán mới',
      content: `${patientName} đã thanh toán hóa đơn ${
        updatedInvoice.invoiceNumber
      } (${this.formatVNCurrency(Number(updatedInvoice.totalAmount))}).`,
      metadata: {
        invoiceId: updatedInvoice.id,
        amount: Number(updatedInvoice.totalAmount),
      },
    });

    return updatedInvoice;
  }

  /**
   * List invoices for the logged-in patient.
   */
  async listMyInvoices(
    userId: string,
    params: {
      status?: InvoiceStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const patientProfile =
      await this.profileRepository.findPatientProfileByUserId(userId);

    if (!patientProfile) {
      // If user has no patient profile, return empty list
      return {
        invoices: [],
        pagination: {
          total: 0,
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          totalPages: 0,
        },
      };
    }

    return this.listInvoices({
      ...params,
      patientProfileId: patientProfile.id,
    });
  }

  // Workspace Endpoints

  async getWorkspaceQueue(params: { search?: string }) {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
    const now = new Date();
    const nowVN = new Date(now.getTime() + VN_OFFSET_MS);
    const todayStart = new Date(
      Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate()),
    );
    const tomorrowStart = new Date(todayStart.getTime() + 86400_000);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400_000);

    const bookings = await this.bookingRepository.findWorkspaceQueueBookings({
      todayStart,
      tomorrowStart,
      thirtyDaysAgo,
      search: params.search,
    });

    const queueItems = bookings.map((booking) => {
      const invoices = booking.invoices || [];
      const totalAmount = invoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );
      const paidAmount = invoices
        .filter((inv) => inv.status === InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const pendingAmount = totalAmount - paidAmount;

      // Logic to determine workflow step (B1, B3, B8)
      let currentStepCode = 'B1';
      const visitStep = booking.medicalRecord?.visitStep;

      const isConsultationPaid = invoices
        .filter((i) => i.invoiceType === InvoiceType.CONSULTATION)
        .every((i) => i.status === InvoiceStatus.PAID);

      if (booking.status === BookingStatus.COMPLETED) {
        currentStepCode = 'B8';
      } else if (
        visitStep === VisitStep.SERVICES_ORDERED ||
        booking.status === BookingStatus.AWAITING_RESULTS ||
        visitStep === VisitStep.AWAITING_RESULTS ||
        visitStep === VisitStep.RESULTS_READY
      ) {
        currentStepCode = 'B3';
      } else if (
        booking.status === BookingStatus.CHECKED_IN ||
        booking.status === BookingStatus.IN_PROGRESS ||
        visitStep === VisitStep.SYMPTOMS_TAKEN
      ) {
        // Already in progress but might still need B1 if not paid
        currentStepCode = !isConsultationPaid ? 'B1' : 'B3';
      } else if (
        booking.status === BookingStatus.QUEUED &&
        !isConsultationPaid
      ) {
        currentStepCode = 'B1';
      }

      return {
        bookingId: booking.id,
        patientName: booking.patientProfile.fullName,
        patientCode: booking.patientProfile.patientCode,
        doctorName: booking.doctor?.fullName || 'N/A',
        patientGender: booking.patientProfile.gender,
        patientDob: booking.patientProfile.dateOfBirth,
        bookingCode: booking.bookingCode,
        totalAmount,
        paidAmount,
        pendingAmount,
        status: booking.status,
        visitStep: visitStep,
        currentStepCode,
        isUrgent: booking.priority === BookingPriority.URGENT,
        createdAt: booking.createdAt,
        invoiceTypes: invoices.map((i) => i.invoiceType),
      };
    });

    return queueItems;
  }

  async getWorkspaceKpis() {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowVN = new Date(Date.now() + VN_OFFSET_MS);
    const today = new Date(
      Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate()),
    );
    const tomorrow = new Date(today.getTime() + 86400_000);

    const invoices = await this.financeRepository.findInvoicesInDateRange(
      today,
      tomorrow,
    );

    // We also need to count bookings that have pending invoices
    const bookingsWithInvoices =
      await this.bookingRepository.findBookingsWithInvoicesInDateRange(
        today,
        tomorrow,
      );

    const awaitingPaymentCount = bookingsWithInvoices.filter((b) =>
      b.invoices.some((inv) => inv.status !== InvoiceStatus.PAID),
    ).length;

    const completedPaymentCount = bookingsWithInvoices.filter(
      (b) =>
        b.invoices.length > 0 &&
        b.invoices.every((inv) => inv.status === InvoiceStatus.PAID),
    ).length;

    const totalRevenue = invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    const totalInvoicesValue = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    return {
      awaitingPaymentCount,
      completedPaymentCount,
      totalRevenue,
      totalInvoicesValue,
    };
  }
}
