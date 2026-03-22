import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreateInvoiceDto,
  AddInvoiceItemDto,
  ConfirmPaymentDto,
} from './dto/billing.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { InvoiceStatus, LabOrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // Invoice CRUD

  /**
   * Create a DRAFT invoice for a booking.
   * Auto-seeds a first line item from the booking's service.
   * Idempotent: returns existing invoice if already exists.
   */
  async createInvoice(dto: CreateInvoiceDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        service: true,
        patientProfile: { select: { id: true, fullName: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // Idempotent: return existing invoice
    const existing = await this.prisma.invoice.findUnique({
      where: { bookingId: dto.bookingId },
      include: { items: true, payments: true },
    });
    if (existing) {
      return ResponseHelper.success(
        existing,
        'BILLING.INVOICE_FETCHED',
        'Invoice already exists',
        200,
      );
    }

    const servicePrice = booking.service.price;

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          bookingId: dto.bookingId,
          patientProfileId: booking.patientProfileId,
          invoiceNumber,
          subtotal: servicePrice,
          discountAmount: 0,
          vatRate: 0,
          vatAmount: 0,
          taxAmount: 0,
          totalAmount: servicePrice,
          status: InvoiceStatus.DRAFT,
          notes: dto.notes,
        },
      });

      // Seed first item from booking service
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
   * Get invoice by booking ID.
   */
  async getInvoiceByBooking(bookingId: string) {
    const invoice = await this.prisma.invoice.findUnique({
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
              },
            },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!invoice)
      throw new NotFoundException('Invoice not found for this booking');

    return ResponseHelper.success(
      invoice,
      'BILLING.INVOICE_FETCHED',
      'Invoice retrieved',
      200,
    );
  }

  /**
   * Get invoice by invoice ID.
   */
  async getInvoiceById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
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

    if (!invoice) throw new NotFoundException('Invoice not found');

    return ResponseHelper.success(
      invoice,
      'BILLING.INVOICE_FETCHED',
      'Invoice retrieved',
      200,
    );
  }

  /**
   * List invoices with optional filters (status, patientProfileId, date range).
   */
  async listInvoices(params: {
    status?: InvoiceStatus;
    patientProfileId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      patientProfileId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};
    if (status) where.status = status;
    if (patientProfileId) where.patientProfileId = patientProfileId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
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
      this.prisma.invoice.count({ where }),
    ]);

    return ResponseHelper.success(
      { invoices, total, page, limit, totalPages: Math.ceil(total / limit) },
      'BILLING.INVOICES_LISTED',
      'Invoices retrieved',
      200,
    );
  }

  // Invoice Items

  /**
   * Add an extra line item to a DRAFT invoice (e.g. additional services).
   */
  async addInvoiceItem(invoiceId: string, dto: AddInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.OPEN
    ) {
      throw new ConflictException(
        'Can only add items to DRAFT or OPEN invoice',
      );
    }

    const quantity = dto.quantity ?? 1;
    const totalPrice = dto.unitPrice * quantity;

    const item = await this.prisma.$transaction(async (tx) => {
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.OPEN
    ) {
      throw new ConflictException(
        'Can only remove items from DRAFT or OPEN invoice',
      );
    }

    await this.prisma.$transaction(async (tx) => {
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
   * If Invoice is DRAFT, transitions to OPEN.
   * If dto.labOrderId is provided, marks the LabOrder as PAID.
   */
  async addPayment(
    invoiceId: string,
    dto: ConfirmPaymentDto,
    confirmedByUserId: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Invoice is already finalized and PAID');
    }

    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.REFUNDED
    ) {
      throw new ForbiddenException(
        'Cannot add payment to a cancelled or refunded invoice',
      );
    }

    const insuranceCovered = dto.insuranceCovered ?? 0;
    const patientPaid = dto.amountPaid - insuranceCovered;

    await this.prisma.$transaction(async (tx) => {
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

      // Change status to OPEN if it was DRAFT
      if (invoice.status === InvoiceStatus.DRAFT) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.OPEN },
        });
      }

      // If tied to a lab order, mark LabOrder as PAID
      if (dto.labOrderId) {
        // Also verify the lab order exists inside the invoice item
        await tx.labOrder.update({
          where: { id: dto.labOrderId },
          data: { status: LabOrderStatus.PAID },
        });
      }
    });

    const updated = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, payments: true },
    });

    return ResponseHelper.success(
      updated,
      'BILLING.PAYMENT_ADDED',
      'Payment added',
      200,
    );
  }

  /**
   * Finalize the invoice (ISSUED/OPEN -> PAID)
   */
  async finalizeInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Invoice is already finalized');
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

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        insuranceClaimed: totalInsurance > 0,
        insuranceAmount: totalInsurance,
        patientCoPayment: totalPatient,
      },
      include: { items: true, payments: true },
    });

    return ResponseHelper.success(
      updatedInvoice,
      'BILLING.INVOICE_FINALIZED',
      'Invoice finalized and PAID',
      200,
    );
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
