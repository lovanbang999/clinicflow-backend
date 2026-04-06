import { Injectable, HttpStatus } from '@nestjs/common';
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
import { Inject } from '@nestjs/common';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import {
  InvoiceStatus,
  InvoiceType,
  LabOrderStatus,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { LabOrdersGateway } from '../lab-orders/lab-orders.gateway';
import { format } from 'date-fns';

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
    private readonly labOrdersGateway: LabOrdersGateway,
  ) {}

  private formatVNCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  // Invoice CRUD

  /**
   * Create a DRAFT invoice for a booking.
   * A booking can have multiple invoices (Consultation / Lab / Pharmacy).
   * Auto-seeds a first line item from the booking's service (for CONSULTATION type).
   */
  async createInvoice(dto: CreateInvoiceDto) {
    const booking = await this.bookingRepository.findUniqueBooking({
      where: { id: dto.bookingId },
      include: {
        service: true,
        patientProfile: { select: { id: true, fullName: true } },
      },
    });

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const invoiceType = dto.invoiceType ?? InvoiceType.CONSULTATION;
    const servicePrice = booking.service.price;

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const count = await this.financeRepository.countInvoice({});
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await this.financeRepository.transaction(async (tx) => {
      const seedSubtotal =
        invoiceType === InvoiceType.CONSULTATION ? Number(servicePrice) : 0;

      const inv = await tx.invoice.create({
        data: {
          bookingId: dto.bookingId,
          patientProfileId: booking.patientProfileId,
          invoiceType,
          invoiceNumber,
          subtotal: seedSubtotal,
          discountAmount: 0,
          vatRate: 0,
          vatAmount: 0,
          taxAmount: 0,
          totalAmount: seedSubtotal,
          status: InvoiceStatus.DRAFT,
          notes: dto.notes,
        },
      });

      // For CONSULTATION: seed first item from booking service
      if (invoiceType === InvoiceType.CONSULTATION) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: inv.id,
            serviceId: booking.serviceId,
            itemName: booking.service.name,
            unitPrice: servicePrice,
            quantity: 1,
            totalPrice: servicePrice,
            sortOrder: 0,
          },
        });
      }

      let totalToUpdate = seedSubtotal;

      // For LAB: auto-seed items from PENDING lab orders not yet assigned to any invoice
      if (invoiceType === InvoiceType.LAB) {
        const labOrderWhere: Prisma.LabOrderWhereInput = {
          bookingId: dto.bookingId,
          status: LabOrderStatus.PENDING,
          invoiceItem: null, // not yet added to any invoice
        };
        if (dto.labOrderIds && dto.labOrderIds.length > 0) {
          labOrderWhere.id = { in: dto.labOrderIds };
        }

        const pendingOrders = await tx.labOrder.findMany({
          where: labOrderWhere,
          orderBy: { createdAt: 'asc' },
          include: { service: { select: { price: true } } }, // Fetch real service price
        });

        for (let i = 0; i < pendingOrders.length; i++) {
          const order = pendingOrders[i];
          const price = order.service?.price ? Number(order.service.price) : 0;
          const itemName = order.testName;

          const item = await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              labOrderId: order.id,
              itemName,
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: i,
            },
          });
          totalToUpdate += Number(item.totalPrice);
        }
      }

      // Add manual items if provided
      if (dto.items && dto.items.length > 0) {
        for (let i = 0; i < dto.items.length; i++) {
          const mItem = dto.items[i];
          const qty = mItem.quantity ?? 1;
          const tPrice = Number(mItem.unitPrice) * qty;

          const item = await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              serviceId: mItem.serviceId,
              labOrderId: mItem.labOrderId,
              itemName: mItem.itemName,
              unitPrice: mItem.unitPrice,
              quantity: qty,
              totalPrice: tPrice,
              sortOrder: mItem.sortOrder ?? 100 + i,
            },
          });
          totalToUpdate += Number(item.totalPrice);
        }
      }

      // Recalculate totals
      if (totalToUpdate !== seedSubtotal) {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { subtotal: totalToUpdate, totalAmount: totalToUpdate },
        });
      }

      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: { items: true, payments: true },
      });
    });

    return ResponseHelper.success(
      invoice,
      'BILLING.INVOICE_CREATED',
      'Invoice created',
      201,
    );
  }

  /**
   * Delete a DRAFT invoice. Used when a receptionist creates an invoice by mistake
   * or wants to undo the creation of an invoice.
   * This cascades and deletes the InvoiceItems.
   * As a result, any linked LabOrders will be unlinked (invoiceItem becomes null)
   * and they will reappear in the pending lab orders list.
   */
  async deleteInvoice(id: string) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id },
    });
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

    await this.financeRepository.deleteInvoice({ where: { id } });
    return ResponseHelper.success(
      null,
      'BILLING.INVOICE_DELETED',
      'Invoice deleted',
      200,
    );
  }

  /**
   * List all invoices for a booking (multiple invoices per booking).
   */
  async listInvoicesByBooking(bookingId: string) {
    const booking = await this.bookingRepository.findUniqueBooking({
      where: { id: bookingId },
      select: { id: true },
    });
    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const invoices = await this.financeRepository.findManyInvoice({
      where: { bookingId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        booking: {
          include: {
            doctor: { select: { id: true, fullName: true } },
            patientProfile: {
              select: {
                id: true,
                fullName: true,
                patientCode: true,
                phone: true,
                insuranceNumber: true,
                dateOfBirth: true,
                gender: true,
              },
            },
            service: { select: { id: true, name: true } },
            queueRecord: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return ResponseHelper.success(
      invoices,
      'BILLING.INVOICES_FETCHED',
      'Invoices retrieved for booking',
      200,
    );
  }

  /**
   * Get invoice by invoice ID.
   */
  async getInvoiceById(id: string) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        booking: {
          include: {
            doctor: { select: { id: true, fullName: true } },
            patientProfile: {
              select: {
                id: true,
                fullName: true,
                patientCode: true,
                phone: true,
              },
            },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiException(
        MessageCodes.INVOICE_NOT_FOUND,
        'Invoice not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return ResponseHelper.success(
      invoice,
      'BILLING.INVOICE_FETCHED',
      'Invoice retrieved',
      200,
    );
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
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      patientProfileId,
      invoiceType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};
    if (status) where.status = status;
    if (patientProfileId) where.patientProfileId = patientProfileId;
    if (invoiceType) where.invoiceType = invoiceType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      this.financeRepository.findManyInvoice({
        where,
        include: {
          items: { take: 1, orderBy: { sortOrder: 'asc' } },
          booking: {
            include: {
              patientProfile: { select: { fullName: true, patientCode: true } },
              doctor: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.financeRepository.countInvoice({ where }),
    ]);

    return ResponseHelper.success(
      {
        invoices,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      'BILLING.INVOICES_LISTED',
      'Invoices retrieved',
      200,
    );
  }

  /**
   * Get PENDING lab orders of a booking that are not yet added to any invoice.
   * Used by receptionist to know if they need to create a LAB invoice.
   */
  async getPendingLabOrdersForBilling(bookingId: string) {
    const orders = await this.clinicalRepository.findManyLabOrder({
      where: {
        bookingId,
        status: LabOrderStatus.PENDING,
        invoiceItem: null, // not yet added to any invoice
      },
      orderBy: { createdAt: 'asc' },
    });

    return ResponseHelper.success(
      orders,
      'BILLING.PENDING_LABS_FETCHED',
      'Pending unbilled lab orders',
      200,
    );
  }

  // Invoice Items

  /**
   * Add an extra line item to a DRAFT invoice (e.g. additional services).
   */
  async addInvoiceItem(invoiceId: string, dto: AddInvoiceItemDto) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
    });
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

    const item = await this.financeRepository.transaction(async (tx) => {
      const newItem = await tx.invoiceItem.create({
        data: {
          invoiceId,
          serviceId: dto.serviceId,
          itemName: dto.itemName,
          unitPrice: dto.unitPrice,
          quantity,
          totalPrice,
          sortOrder: dto.sortOrder ?? 0,
          labOrderId: dto.labOrderId,
        },
      });

      // Recalculate totals
      await this.recalculateTotals(tx, invoiceId);

      return newItem;
    });

    return ResponseHelper.success(
      item,
      'BILLING.ITEM_ADDED',
      'Item added to invoice',
      201,
    );
  }

  /**
   * Remove a line item from a DRAFT invoice.
   */
  async removeInvoiceItem(invoiceId: string, itemId: string) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
    });
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

    await this.financeRepository.transaction(async (tx) => {
      await tx.invoiceItem.delete({ where: { id: itemId } });
      await this.recalculateTotals(tx, invoiceId);
    });

    return ResponseHelper.success(
      null,
      'BILLING.ITEM_REMOVED',
      'Item removed',
      200,
    );
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
  ) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
      include: {
        payments: true,
        booking: {
          include: {
            patientProfile: { select: { fullName: true } },
          },
        },
      },
    });

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

    const insuranceCovered = dto.insuranceCovered ?? 0;
    const patientPaid = dto.amountPaid - insuranceCovered;

    // Calculate total paid after this payment
    const previouslyPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amountPaid),
      0,
    );
    const newTotalPaid = previouslyPaid + dto.amountPaid;
    const invoiceTotal = Number(invoice.totalAmount);
    const shouldAutoFinalize = newTotalPaid >= invoiceTotal;

    await this.financeRepository.transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          amountPaid: dto.amountPaid,
          insuranceCovered,
          patientPaid: patientPaid < 0 ? 0 : patientPaid,
          paymentMethod: dto.paymentMethod,
          insuranceNumber: dto.insuranceNumber,
          transactionRef: dto.transactionRef,
          confirmedBy: confirmedByUserId,
          notes: dto.notes,
          paidAt: new Date(),
        },
      });

      if (shouldAutoFinalize) {
        // Auto-finalize: PAID ngay khi đủ tiền
        const totalInsurance =
          invoice.payments.reduce(
            (sum, p) => sum + Number(p.insuranceCovered),
            0,
          ) + insuranceCovered;
        const totalPatient =
          invoice.payments.reduce((sum, p) => sum + Number(p.patientPaid), 0) +
          (patientPaid < 0 ? 0 : patientPaid);

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
            insuranceClaimed: totalInsurance > 0,
            insuranceAmount: totalInsurance,
            patientCoPayment: totalPatient,
          },
        });

        // If LAB invoice: mark ALL linked lab orders as PAID (READY TO PERFORM)
        if (invoice.invoiceType === InvoiceType.LAB) {
          const labItems = await tx.invoiceItem.findMany({
            where: { invoiceId, labOrderId: { not: null } },
          });
          if (labItems.length > 0) {
            const labOrderIds = labItems.map((i) => i.labOrderId as string);

            await tx.labOrder.updateMany({
              where: { id: { in: labOrderIds } },
              data: { status: LabOrderStatus.PAID },
            });

            const patientName =
              invoice.booking?.patientProfile?.fullName || 'Khách';

            // Push real-time event to all connected technicians
            this.labOrdersGateway.broadcastNewLabOrder({
              labOrderIds,
              patientName,
              invoiceId: invoice.id,
            });

            // Notify technicians that new lab orders are ready to be performed
            const technicians = await tx.user.findMany({
              where: { role: 'TECHNICIAN' },
              select: { id: true },
            });

            for (const tech of technicians) {
              await this.notificationsService.createInAppNotification({
                userId: tech.id,
                title: 'Phiếu xét nghiệm mới',
                content: `Bệnh nhân ${patientName} đã thanh toán. Vui lòng thực hiện các chỉ định xét nghiệm.`,
                type: 'LAB_RESULT_READY',
                metadata: {
                  invoiceId: invoice.id,
                  bookingId: invoice.bookingId,
                },
              });
            }
          }
        }
      } else if (invoice.status === InvoiceStatus.DRAFT) {
        // First payment: DRAFT → OPEN
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.OPEN },
        });
      }

      // If tied to a specific lab order (single payment for 1 lab order), mark that one too
      if (dto.labOrderId) {
        await tx.labOrder.update({
          where: { id: dto.labOrderId },
          data: { status: LabOrderStatus.PAID },
        });
      }
    });

    const updated = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
      include: {
        items: true,
        payments: true,
        booking: {
          include: {
            patientProfile: {
              select: {
                id: true,
                userId: true,
                fullName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    });

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
        .catch((err) => console.error('Failed to send invoice email', err));
    }

    return ResponseHelper.success(
      updated,
      'BILLING.PAYMENT_ADDED',
      shouldAutoFinalize
        ? 'Payment added and invoice finalized'
        : 'Payment added',
      200,
    );
  }

  /**
   * Manually finalize the invoice (ISSUED/OPEN → PAID).
   * Normally called automatically by addPayment when total is met.
   */
  async finalizeInvoice(invoiceId: string) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
      include: { payments: true },
    });

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

    const updatedInvoice = await this.financeRepository.updateInvoice({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        insuranceClaimed: totalInsurance > 0,
        insuranceAmount: totalInsurance,
        patientCoPayment: totalPatient,
      },
      include: {
        items: true,
        payments: true,
        booking: {
          include: {
            patientProfile: {
              select: {
                id: true,
                userId: true,
                fullName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    });

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
        .catch((err) => console.error('Failed to send invoice email', err));
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
        amount: updatedInvoice.totalAmount,
      },
    });

    return ResponseHelper.success(
      updatedInvoice,
      'BILLING.INVOICE_FINALIZED',
      'Invoice finalized and PAID',
      200,
    );
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
      await this.profileRepository.findUniquePatientProfile({
        where: { userId },
        select: { id: true },
      });

    if (!patientProfile) {
      // If user has no patient profile, return empty list
      return ResponseHelper.success(
        {
          invoices: [],
          total: 0,
          page: params.page,
          limit: params.limit,
          totalPages: 0,
        },
        'BILLING.INVOICES_LISTED',
        'No patient profile found',
        200,
      );
    }

    return this.listInvoices({
      ...params,
      patientProfileId: patientProfile.id,
    });
  }

  // Private Helpers

  private async recalculateTotals(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    const items = await tx.invoiceItem.findMany({ where: { invoiceId } });
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    const vatRate = Number(invoice?.vatRate ?? 0);
    const discountAmount = Number(invoice?.discountAmount ?? 0);

    const vatAmount = (subtotal - discountAmount) * (vatRate / 100);
    const totalAmount = subtotal - discountAmount + vatAmount;

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal,
        vatAmount,
        taxAmount: vatAmount,
        totalAmount: totalAmount < 0 ? 0 : totalAmount,
      },
    });
  }
}
