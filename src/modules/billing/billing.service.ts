import { Injectable, HttpStatus, forwardRef } from '@nestjs/common';
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
  BookingStatus,
  VisitStep,
  Prisma,
  ServiceOrderStatus,
  BookingPriority,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { LabOrdersGateway } from '../lab-orders/lab-orders.gateway';
import { QueueGateway } from '../queue/queue.gateway';
import { format } from 'date-fns';
import { QueueService } from '../queue/queue.service';

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
  ) {}

  private formatVNCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  /**
   * Calculates the suggested order for a patient to visit clinical rooms
   * based on preparation requirements (e.g. fasting), current queue size,
   * and physical location (grouping by room/category).
   */
  private async assignSmartQueueOrder(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    // 1. Fetch all items with their services and categories
    const items = await tx.invoiceItem.findMany({
      where: { invoiceId },
      include: {
        labOrder: {
          include: {
            service: {
              include: {
                category: true,
              },
            },
          },
        },
        visitServiceOrder: {
          include: {
            service: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    // 2. Extract and combine orders
    const orders = items
      .map((item) => ({
        id: item.labOrder?.id || item.visitServiceOrderId,
        type: item.labOrder ? 'LAB' : 'VSO',
        queueNumber:
          item.labOrder?.queueNumber || item.visitServiceOrder?.queueNumber,
        service: item.labOrder?.service || item.visitServiceOrder?.service,
      }))
      .filter((o) => o.id && o.service);

    if (orders.length === 0) return;

    // 3. Sorting logic (Level 2: Optimized Suggestion)
    // Priority: Fasting/Preparation -> Lower Queue Number -> Shorter Duration
    const sortedOrders = [...orders].sort((a, b) => {
      // Priority 1: Preparation notes (e.g., "Fasting" / "Nhịn ăn")
      const aHasPrep = a.service?.preparationNotes ? 1 : 0;
      const bHasPrep = b.service?.preparationNotes ? 1 : 0;
      if (aHasPrep !== bHasPrep) return bHasPrep - aHasPrep;

      // Priority 2: Queue Number (lower is better, less wait)
      const aQN = a.queueNumber ?? 9999;
      const bQN = b.queueNumber ?? 9999;
      if (aQN !== bQN) return aQN - bQN;

      // Priority 3: Shorter duration first
      const aDur = a.service?.durationMinutes ?? 0;
      const bDur = b.service?.durationMinutes ?? 0;
      return aDur - bDur;
    });

    // 4. Update suggestedOrder and groupKey in DB
    for (let i = 0; i < sortedOrders.length; i++) {
      const order = sortedOrders[i];
      const suggestedOrder = i + 1;

      // Determine groupKey: Group by Category Code + PerformerType
      const groupKey = `${order.service?.performerType}-${order.service?.categoryId || 'none'}`;

      if (order.type === 'LAB') {
        await tx.labOrder.update({
          where: { id: order.id as string },
          data: { suggestedOrder, groupKey } as Prisma.LabOrderUpdateInput & {
            suggestedOrder: number;
            groupKey: string;
          },
        });
      } else {
        await tx.visitServiceOrder.update({
          where: { id: order.id as string },
          data: {
            suggestedOrder,
            groupKey,
          } as Prisma.VisitServiceOrderUpdateInput & {
            suggestedOrder: number;
            groupKey: string;
          },
        });
      }
    }
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
      const profile = await this.profileRepository.findFirstPatientProfile({
        where: { userId: currentUser.id },
      });
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
      const treatmentRelation = await this.bookingRepository.findFirst({
        where: {
          doctorId: currentUser.id,
          patientProfileId,
        },
      });

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
  async createInvoice(dto: CreateInvoiceDto, currentUser?: Express.User) {
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
    const servicePrice = booking.service?.price ?? 0;

    // Guard: PHARMACY invoice can only be created on the same day as the booking
    if (invoiceType === InvoiceType.PHARMACY) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDay = new Date(booking.bookingDate);
      bookingDay.setHours(0, 0, 0, 0);
      if (bookingDay.getTime() !== today.getTime()) {
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
    const count = await this.financeRepository.countInvoice({});
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    const result = await this.financeRepository.transaction(async (tx) => {
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

      // For CONSULTATION: seed first item from booking service (only if service is known)
      if (invoiceType === InvoiceType.CONSULTATION && booking.service) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: inv.id,
            serviceId: booking.serviceId,
            itemName: booking.service.name,
            unitPrice: servicePrice,
            quantity: 1,
            totalPrice: servicePrice,
            sortOrder: 0,
          } as Prisma.InvoiceItemUncheckedCreateInput & {
            visitServiceOrderId?: string | null;
          },
        });
      }

      let totalToUpdate = seedSubtotal;

      if (invoiceType === InvoiceType.LAB) {
        const labOrderWhere: Prisma.LabOrderWhereInput = {
          bookingId: dto.bookingId,
          status: LabOrderStatus.PENDING,
          invoiceItem: null,
        };
        if (dto.labOrderIds && dto.labOrderIds.length > 0) {
          labOrderWhere.id = { in: dto.labOrderIds };
        }

        const pendingLabs = await tx.labOrder.findMany({
          where: labOrderWhere,
          orderBy: { createdAt: 'asc' },
          include: { service: { select: { price: true } } },
        });

        const vsoWhere = {
          bookingId: dto.bookingId,
          status: ServiceOrderStatus.PENDING,
          invoiceItem: null,
        } as Prisma.VisitServiceOrderWhereInput & { invoiceItem?: null };
        if (dto.visitServiceOrderIds && dto.visitServiceOrderIds.length > 0) {
          vsoWhere.id = { in: dto.visitServiceOrderIds };
        }

        const pendingVsos = await tx.visitServiceOrder.findMany({
          where: vsoWhere,
          orderBy: { createdAt: 'asc' },
          include: { service: { select: { price: true, name: true } } },
        });

        let sortOrderValue = 0;

        for (const order of pendingLabs) {
          const price = order.service?.price ? Number(order.service.price) : 0;
          const item = await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              labOrderId: order.id,
              itemName: order.testName ?? 'Lab test',
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: sortOrderValue++,
            } as Prisma.InvoiceItemUncheckedCreateInput & {
              visitServiceOrderId?: string | null;
            },
          });
          totalToUpdate += Number(item.totalPrice);
        }

        for (const vso of pendingVsos) {
          const price = vso.service?.price ? Number(vso.service.price) : 0;
          const item = await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              visitServiceOrderId: vso.id,
              itemName: vso.service?.name ?? 'Clinical service',
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: sortOrderValue++,
            } as Prisma.InvoiceItemUncheckedCreateInput & {
              visitServiceOrderId?: string | null;
            },
          });
          totalToUpdate += Number(item.totalPrice);
        }
      }

      if (dto.items && dto.items.length > 0) {
        for (let i = 0; i < dto.items.length; i++) {
          const mItem = dto.items[i];
          const qty = mItem.quantity ?? 1;
          const tPrice = Number(mItem.unitPrice) * qty;

          const item = await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              serviceId: mItem.serviceId,
              itemName: mItem.itemName,
              unitPrice: mItem.unitPrice,
              quantity: qty,
              totalPrice: tPrice,
              sortOrder: mItem.sortOrder ?? 0,
            } as Prisma.InvoiceItemUncheckedCreateInput & {
              visitServiceOrderId?: string | null;
            },
          });
          totalToUpdate += Number(item.totalPrice);
        }
      }

      const updatedInv = await tx.invoice.update({
        where: { id: inv.id },
        data: {
          subtotal: totalToUpdate,
          totalAmount: totalToUpdate,
        },
      });

      return updatedInv;
    });

    return ResponseHelper.success(
      result,
      'BILLING.INVOICE_CREATED',
      'Invoice created successfully',
      201,
    );
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

  async syncLabInvoice(bookingId: string) {
    const invoice = await this.financeRepository.findFirstInvoice({
      where: {
        bookingId,
        invoiceType: InvoiceType.LAB,
        status: InvoiceStatus.DRAFT,
      },
    });

    const pendingLabs = await this.clinicalRepository.findManyLabOrder({
      where: {
        bookingId,
        status: LabOrderStatus.PENDING,
      },
      include: { service: { select: { price: true } } },
    });

    const pendingVsos = await this.clinicalRepository.findManyVisitServiceOrder(
      {
        where: {
          bookingId,
          status: ServiceOrderStatus.PENDING,
        },
        include: { service: { select: { price: true, name: true } } },
      },
    );

    if (pendingLabs.length === 0 && pendingVsos.length === 0 && !invoice) {
      return null;
    }

    if (!invoice) {
      const result = await this.createInvoice({
        bookingId,
        invoiceType: InvoiceType.LAB,
      });
      this.labOrdersGateway.server.emit('billing_list_refresh', { bookingId });
      return result.data;
    }

    await this.financeRepository.transaction(async (tx) => {
      const existingItems = await tx.invoiceItem.findMany({
        where: { invoiceId: invoice.id },
      });
      const existingLabOrderIds = existingItems
        .filter((it) => it.labOrderId)
        .map((it) => it.labOrderId);
      const existingVsoIds = existingItems
        .filter(
          (it) =>
            (it as typeof it & { visitServiceOrderId?: string | null })
              .visitServiceOrderId,
        )
        .map(
          (it) =>
            (it as typeof it & { visitServiceOrderId?: string | null })
              .visitServiceOrderId,
        )
        .filter(Boolean) as string[];

      for (const order of pendingLabs) {
        if (!existingLabOrderIds.includes(order.id)) {
          const price = order.service?.price ? Number(order.service.price) : 0;
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              labOrderId: order.id,
              itemName: order.testName ?? 'Lab test',
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: 0,
            } as Prisma.InvoiceItemUncheckedCreateInput & {
              visitServiceOrderId?: string | null;
            },
          });
        }
      }

      for (const vso of pendingVsos) {
        if (!existingVsoIds.includes(vso.id)) {
          const price = vso.service?.price ? Number(vso.service.price) : 0;
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              visitServiceOrderId: vso.id,
              itemName: vso.service?.name ?? 'Clinical service',
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: 0,
            } as Prisma.InvoiceItemUncheckedCreateInput & {
              visitServiceOrderId?: string | null;
            },
          });
        }
      }

      const currentPendingLabIds = pendingLabs.map((o) => o.id);
      const currentPendingVsoIds = pendingVsos.map((o) => o.id);

      for (const item of existingItems) {
        if (
          item.labOrderId &&
          !currentPendingLabIds.includes(item.labOrderId)
        ) {
          await tx.invoiceItem.delete({ where: { id: item.id } });
        } else if (
          (item as { visitServiceOrderId?: string | null })
            .visitServiceOrderId &&
          !currentPendingVsoIds.includes(
            (item as { visitServiceOrderId?: string | null })
              .visitServiceOrderId!,
          )
        ) {
          await tx.invoiceItem.delete({ where: { id: item.id } });
        }
      }

      const allItems = await tx.invoiceItem.findMany({
        where: { invoiceId: invoice.id },
      });

      const newTotal = allItems.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newTotal,
          totalAmount: newTotal,
        },
      });
    });

    // 4. POST-SYNC CHECK: If invoice is now empty (0 items) and it's still a draft, delete it
    const finalItems = await this.financeRepository.findManyInvoiceItem({
      where: { invoiceId: invoice.id },
    });

    if (finalItems.length === 0) {
      // Re-fetch invoice status to be absolutely safe before deleting
      const finalInvoice = await this.financeRepository.findUniqueInvoice({
        where: { id: invoice.id },
      });
      if (finalInvoice && finalInvoice.status === InvoiceStatus.DRAFT) {
        await this.deleteInvoice(invoice.id);
        this.labOrdersGateway.server.emit('billing_list_refresh', {
          bookingId,
        });
        return null;
      }
    }

    this.labOrdersGateway.server.emit('billing_list_refresh', { bookingId });
    return this.getInvoiceById(invoice.id);
  }

  /**
   * List all invoices for a booking (multiple invoices per booking).
   */
  async listInvoicesByBooking(bookingId: string, currentUser?: Express.User) {
    const booking = await this.bookingRepository.findUniqueBooking({
      where: { id: bookingId },
      select: { id: true, patientProfileId: true },
    });
    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validateInvoiceAccess(booking.patientProfileId, currentUser);

    const invoices = await this.financeRepository.findManyInvoice({
      where: { bookingId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { labOrder: true },
        },
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
            medicalRecord: true,
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

  // Get invoice by invoice ID.
  async getInvoiceById(id: string, currentUser?: Express.User) {
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            labOrder: {
              include: {
                service: {
                  include: { category: true },
                },
              },
            },
            visitServiceOrder: {
              include: {
                performer: true,
                service: {
                  include: { category: true },
                },
              },
            },
          },
        },
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
            medicalRecord: true,
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

    await this.validateInvoiceAccess(invoice.patientProfileId, currentUser);

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
    search?: string;
    page?: number;
    limit?: number;
    currentUser?: Express.User;
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
      page = 1,
      limit = 20,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};
    if (status) where.status = status;
    if (patientProfileId) where.patientProfileId = patientProfileId;
    if (invoiceType) where.invoiceType = invoiceType;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        {
          booking: {
            patientProfile: {
              fullName: { contains: search },
            },
          },
        },
        {
          booking: {
            patientProfile: {
              patientCode: { contains: search },
            },
          },
        },
      ];
    }
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
          items: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            include: { labOrder: true },
          },
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
          visitServiceOrderId: dto.visitServiceOrderId,
        } as Prisma.InvoiceItemUncheckedCreateInput & {
          visitServiceOrderId?: string | null;
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
    currentUser?: Express.User,
  ) {
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
    const invoice = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
      include: {
        payments: true,
        booking: {
          include: {
            patientProfile: { select: { fullName: true, userId: true } },
            medicalRecord: true,
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

    if (invoice.invoiceType === InvoiceType.CONSULTATION) {
      const isAwaitingResults = invoice.booking?.status === 'AWAITING_RESULTS';
      const isCompleted = invoice.booking?.status === 'COMPLETED';
      const visitStep = (
        invoice.booking as typeof invoice.booking & {
          medicalRecord?: { visitStep: VisitStep };
        }
      )?.medicalRecord?.visitStep;

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
    const patientPaid = dto.amountPaid - insuranceCovered;

    // Calculate total paid after this payment
    const previouslyPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amountPaid),
      0,
    );
    const newTotalPaid = previouslyPaid + dto.amountPaid;
    const invoiceTotal = Number(invoice.totalAmount);
    const shouldAutoFinalize = newTotalPaid >= invoiceTotal;

    let broadcastPayload: {
      labOrderIds: string[];
      patientName: string;
      invoiceId: string;
    } | null = null;

    // Track VSO IDs paid in this transaction for post-commit broadcast
    let paidVsoIds: string[] = [];

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

        // If LAB invoice: mark ALL linked lab orders and visit service orders as PAID
        if (invoice.invoiceType === InvoiceType.LAB) {
          const paidItems = await tx.invoiceItem.findMany({
            where: { invoiceId },
          });

          const labOrderIds = paidItems
            .filter((i) => i.labOrderId)
            .map((i) => i.labOrderId as string);

          const vsoIds = paidItems
            .filter(
              (i) =>
                (i as typeof i & { visitServiceOrderId?: string | null })
                  .visitServiceOrderId,
            )
            .map(
              (i) =>
                (i as typeof i & { visitServiceOrderId?: string | null })
                  .visitServiceOrderId as string,
            );

          // Save VSO ids outside transaction scope for post-commit broadcast
          paidVsoIds = vsoIds;

          if (labOrderIds.length > 0 || vsoIds.length > 0) {
            if (labOrderIds.length > 0) {
              await tx.labOrder.updateMany({
                where: { id: { in: labOrderIds } },
                data: {
                  status: LabOrderStatus.PAID,
                },
              });
            }

            if (vsoIds.length > 0) {
              // Assign queue numbers for specialist services
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);

              for (const vsoId of vsoIds) {
                const lastOrder = await tx.visitServiceOrder.findFirst({
                  where: {
                    createdAt: { gte: startOfDay },
                    queueNumber: { not: null },
                  },
                  orderBy: { queueNumber: 'desc' },
                  select: { queueNumber: true },
                });
                const nextQueueNumber: number =
                  (Number(lastOrder?.queueNumber) || 0) + 1;

                await tx.visitServiceOrder.update({
                  where: { id: vsoId },
                  data: {
                    status: ServiceOrderStatus.PAID,
                    paidAt: new Date(),
                    queueNumber: nextQueueNumber,
                  },
                });
              }
            }

            // Assign daily queue numbers to each paid lab order
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            for (const labOrderId of labOrderIds) {
              const lastOrder = await tx.labOrder.findFirst({
                where: {
                  createdAt: { gte: startOfDay },
                  queueNumber: { not: null },
                },
                orderBy: { queueNumber: 'desc' },
                select: { queueNumber: true },
              });
              const nextQueueNumber: number =
                (Number(lastOrder?.queueNumber) || 0) + 1;

              await tx.labOrder.update({
                where: { id: labOrderId },
                data: {
                  queueNumber: nextQueueNumber,
                },
              });
            }

            // Calculate Smart Queue Suggested Order
            await this.assignSmartQueueOrder(tx, invoice.id);

            const patientName =
              invoice.booking?.patientProfile?.fullName || 'Khách';

            // Capture data for post-commit broadcast
            broadcastPayload = {
              labOrderIds,
              patientName,
              invoiceId: invoice.id,
            };

            // Step3 → After LAB payment: transition booking to AWAITING_RESULTS
            // Patient is now heading to the lab/procedure room
            await tx.booking.update({
              where: { id: invoice.bookingId },
              data: {
                status: 'AWAITING_RESULTS' as BookingStatus,
              },
            });
            await tx.bookingStatusHistory.create({
              data: {
                bookingId: invoice.bookingId,
                oldStatus: 'IN_PROGRESS',
                newStatus: 'AWAITING_RESULTS' as BookingStatus,
                changedById: confirmedByUserId,
                reason:
                  'LAB invoice paid — patient heading to procedure/lab room',
              },
            });

            // Also update MedicalRecord visitStep to AWAITING_RESULTS
            await tx.medicalRecord.updateMany({
              where: { bookingId: invoice.bookingId },
              data: {
                visitStep: 'AWAITING_RESULTS' as VisitStep,
              },
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
                type: 'SYSTEM',
                metadata: {
                  invoiceId: invoice.id,
                  bookingId: invoice.bookingId,
                } as Prisma.InputJsonValue,
              });
            }

            // Notify Patient
            if (invoice.booking?.patientProfile?.userId) {
              await this.notificationsService.createInAppNotification({
                userId: invoice.booking.patientProfile.userId,
                title: 'Thanh toán xét nghiệm thành công',
                content: `Thanh toán cho các chỉ định xét nghiệm đã được xác nhận. Vui lòng di chuyển đến khu vực cận lâm sàng.`,
                type: 'SYSTEM',
                metadata: { bookingId: invoice.bookingId },
              });
            }
          }
        }

        // If CONSULTATION invoice: if a specialist service is assigned by doctor, auto re-queue
        if (
          invoice.invoiceType === InvoiceType.CONSULTATION &&
          invoice.booking?.serviceId &&
          invoice.booking?.doctorId
        ) {
          // Patient has been referred to a specialist and just paid the fee.
          // Auto check-in for the new service.
          // Note: addToQueue handles the status change and queue record creation.
          await this.queueService.addToQueue(
            invoice.bookingId,
            confirmedByUserId,
          );
        }
      } else if (invoice.status === InvoiceStatus.DRAFT) {
        // First payment: DRAFT → OPEN
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: InvoiceStatus.OPEN,
          },
        });
      }

      // If tied to a specific lab order (single payment for 1 lab order), mark that one too
      if (dto.labOrderId) {
        await tx.labOrder.update({
          where: { id: dto.labOrderId },
          data: {
            status: LabOrderStatus.PAID,
          },
        });
      }
    });

    // Broadcast WebSocket event AFTER transaction successfully commits
    if (broadcastPayload) {
      this.labOrdersGateway.broadcastNewLabOrder(broadcastPayload);
    }

    // Broadcast queue updates to each specialist doctor who has a PAID VSO
    if (paidVsoIds.length > 0) {
      const paidVsos = await this.clinicalRepository.findManyVisitServiceOrder({
        where: { id: { in: paidVsoIds }, performedBy: { not: null } },
        select: { performedBy: true },
      });

      const uniqueDoctorIds = [
        ...new Set(
          paidVsos
            .map((v) => v.performedBy)
            .filter((id): id is string => id !== null),
        ),
      ];

      for (const docId of uniqueDoctorIds) {
        this.queueGateway.broadcastQueueUpdate(docId, 'CHECK_IN', {
          source: 'specialist_referral',
          invoiceId,
        });
      }
    }

    const updated = await this.financeRepository.findUniqueInvoice({
      where: { id: invoiceId },
      include: {
        items: {
          include: {
            labOrder: true,
            visitServiceOrder: {
              include: { performer: true, service: true },
            },
          },
        },
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
      include: {
        items: {
          include: {
            labOrder: true,
          },
        },
        payments: true,
        booking: {
          include: {
            patientProfile: true,
            doctor: true,
            room: true,
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
        amount: Number(updatedInvoice.totalAmount),
      } as Prisma.InputJsonValue,
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

  // Workspace Endpoints

  async getWorkspaceQueue(params: { search?: string }) {
    // All bookingDates are stored as UTC midnight (e.g. 2026-04-15T00:00:00.000Z).
    // We must compute date boundaries in UTC explicitly, not via setHours() which
    // is timezone-sensitive and would produce wrong boundaries on a UTC+7 server.
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrowStart = new Date(todayStart.getTime() + 86400_000);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400_000);

    // Date window: today's bookings OR past-30-day in-flight bookings (Option A)
    const dateFilter: Prisma.BookingWhereInput = {
      OR: [
        // Branch 1: Today — all statuses visible (gives receptionist full-day picture)
        { bookingDate: { gte: todayStart, lt: tomorrowStart } },
        // Branch 2: Past 30 days — only bookings still in-flight (not finished)
        {
          bookingDate: { gte: thirtyDaysAgo, lt: todayStart },
          status: {
            notIn: [
              BookingStatus.CANCELLED,
              BookingStatus.NO_SHOW,
              BookingStatus.COMPLETED,
            ],
          },
        },
      ],
    };

    // Search filter (optional)
    const searchFilter: Prisma.BookingWhereInput | undefined = params.search
      ? {
          OR: [
            { bookingCode: { contains: params.search } },
            {
              patientProfile: {
                OR: [
                  { fullName: { contains: params.search } },
                  { phone: { contains: params.search } },
                  { patientCode: { contains: params.search } },
                ],
              },
            },
          ],
        }
      : undefined;

    // Compose final where clause
    const where: Prisma.BookingWhereInput = {
      AND: [
        // Global exclusions
        { status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] } },
        // Date + in-flight filter
        dateFilter,
        // Search (only when provided)
        ...(searchFilter ? [searchFilter] : []),
      ],
    };

    const bookings = await this.bookingRepository.findMany({
      where,
      include: {
        patientProfile: true,
        doctor: { select: { fullName: true } },
        medicalRecord: true,
        invoices: {
          include: { items: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
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

    return ResponseHelper.success(
      queueItems,
      'BILLING.WORKSPACE_QUEUE_FETCHED',
      'Workspace queue retrieved',
      200,
    );
  }

  async getWorkspaceKpis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const invoices = await this.financeRepository.findManyInvoice({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // We also need to count bookings that have pending invoices
    const bookingsWithInvoices = await this.bookingRepository.findMany({
      where: {
        bookingDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      },
      include: {
        invoices: true,
      },
    });

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

    return ResponseHelper.success(
      {
        awaitingPaymentCount,
        completedPaymentCount,
        totalRevenue,
        totalInvoicesValue,
      },
      'BILLING.WORKSPACE_KPIS_FETCHED',
      'Workspace KPIs retrieved',
      200,
    );
  }
}
