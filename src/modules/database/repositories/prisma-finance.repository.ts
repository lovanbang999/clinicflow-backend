import { Injectable } from '@nestjs/common';
import {
  Invoice,
  InvoiceItem,
  Payment,
  Prisma,
  InvoiceStatus,
  InvoiceType,
  BookingStatus,
  LabOrderStatus,
  ServiceOrderStatus,
  VisitStep,
  NotificationChannel,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IFinanceRepository,
  CreateInvoiceInput,
  SyncLabInvoiceOrderInput,
  SyncLabInvoiceVsoInput,
  AddInvoiceItemInput,
  RecordPaymentInput,
} from '../interfaces/finance.repository.interface';
import {
  InvoiceDetailResult,
  InvoiceWithBooking,
  InvoiceDetailForPaymentResult,
  InvoiceDetailPostPaymentResult,
  InvoiceDetailForFinalizeResult,
} from '../types/prisma-payload.types';
import { TransactionClient } from '../interfaces/clinical.repository.interface';

@Injectable()
export class PrismaFinanceRepository implements IFinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  countInvoice(args: Prisma.InvoiceCountArgs): Promise<number> {
    return this.prisma.invoice.count(args);
  }
  findFirstInvoice<T extends Prisma.InvoiceFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceFindFirstArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T> | null> {
    return this.prisma.invoice.findFirst(
      args,
    ) as Promise<Prisma.InvoiceGetPayload<T> | null>;
  }
  findManyInvoice<T extends Prisma.InvoiceFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceFindManyArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T>[]> {
    return this.prisma.invoice.findMany(args) as Promise<
      Prisma.InvoiceGetPayload<T>[]
    >;
  }
  findUniqueInvoice<T extends Prisma.InvoiceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceFindUniqueArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T> | null> {
    return this.prisma.invoice.findUnique(
      args,
    ) as Promise<Prisma.InvoiceGetPayload<T> | null>;
  }
  updateInvoice<T extends Prisma.InvoiceUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceUpdateArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T>> {
    return this.prisma.invoice.update(args) as Promise<
      Prisma.InvoiceGetPayload<T>
    >;
  }
  createInvoice(args: Prisma.InvoiceCreateArgs): Promise<Invoice> {
    return this.prisma.invoice.create(args);
  }
  deleteInvoice(args: Prisma.InvoiceDeleteArgs): Promise<Invoice> {
    return this.prisma.invoice.delete(args);
  }
  groupByInvoice(args: Prisma.InvoiceGroupByArgs): Promise<unknown[]> {
    return this.prisma.invoice.groupBy(args as never) as Promise<unknown[]>;
  }
  aggregateInvoice(
    args: Prisma.InvoiceAggregateArgs,
  ): Promise<Prisma.GetInvoiceAggregateType<Prisma.InvoiceAggregateArgs>> {
    return this.prisma.invoice.aggregate(args);
  }

  countInvoiceItem(args: Prisma.InvoiceItemCountArgs): Promise<number> {
    return this.prisma.invoiceItem.count(args);
  }
  findFirstInvoiceItem<T extends Prisma.InvoiceItemFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceItemFindFirstArgs>,
  ): Promise<Prisma.InvoiceItemGetPayload<T> | null> {
    return this.prisma.invoiceItem.findFirst(
      args,
    ) as Promise<Prisma.InvoiceItemGetPayload<T> | null>;
  }
  findManyInvoiceItem<T extends Prisma.InvoiceItemFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceItemFindManyArgs>,
  ): Promise<Prisma.InvoiceItemGetPayload<T>[]> {
    return this.prisma.invoiceItem.findMany(args) as Promise<
      Prisma.InvoiceItemGetPayload<T>[]
    >;
  }
  findUniqueInvoiceItem<T extends Prisma.InvoiceItemFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceItemFindUniqueArgs>,
  ): Promise<Prisma.InvoiceItemGetPayload<T> | null> {
    return this.prisma.invoiceItem.findUnique(
      args,
    ) as Promise<Prisma.InvoiceItemGetPayload<T> | null>;
  }
  updateInvoiceItem(args: Prisma.InvoiceItemUpdateArgs): Promise<InvoiceItem> {
    return this.prisma.invoiceItem.update(args);
  }
  createInvoiceItem(args: Prisma.InvoiceItemCreateArgs): Promise<InvoiceItem> {
    return this.prisma.invoiceItem.create(args);
  }
  deleteInvoiceItem(args: Prisma.InvoiceItemDeleteArgs): Promise<InvoiceItem> {
    return this.prisma.invoiceItem.delete(args);
  }

  countPayment(args: Prisma.PaymentCountArgs): Promise<number> {
    return this.prisma.payment.count(args);
  }
  findFirstPayment<T extends Prisma.PaymentFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.PaymentFindFirstArgs>,
  ): Promise<Prisma.PaymentGetPayload<T> | null> {
    return this.prisma.payment.findFirst(
      args,
    ) as Promise<Prisma.PaymentGetPayload<T> | null>;
  }
  findManyPayment<T extends Prisma.PaymentFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.PaymentFindManyArgs>,
  ): Promise<Prisma.PaymentGetPayload<T>[]> {
    return this.prisma.payment.findMany(args) as Promise<
      Prisma.PaymentGetPayload<T>[]
    >;
  }
  findUniquePayment<T extends Prisma.PaymentFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PaymentFindUniqueArgs>,
  ): Promise<Prisma.PaymentGetPayload<T> | null> {
    return this.prisma.payment.findUnique(
      args,
    ) as Promise<Prisma.PaymentGetPayload<T> | null>;
  }
  updatePayment(args: Prisma.PaymentUpdateArgs): Promise<Payment> {
    return this.prisma.payment.update(args);
  }
  createPayment(args: Prisma.PaymentCreateArgs): Promise<Payment> {
    return this.prisma.payment.create(args);
  }
  deletePayment(args: Prisma.PaymentDeleteArgs): Promise<Payment> {
    return this.prisma.payment.delete(args);
  }
  groupByPayment(args: Prisma.PaymentGroupByArgs): Promise<unknown[]> {
    return this.prisma.payment.groupBy(args as never) as Promise<unknown[]>;
  }

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  private async assignSmartQueueOrder(
    tx: TransactionClient,
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
    const sortedOrders = [...orders].sort((a, b) => {
      const aHasPrep = a.service?.preparationNotes ? 1 : 0;
      const bHasPrep = b.service?.preparationNotes ? 1 : 0;
      if (aHasPrep !== bHasPrep) return bHasPrep - aHasPrep;

      const aQN = a.queueNumber ?? 9999;
      const bQN = b.queueNumber ?? 9999;
      if (aQN !== bQN) return aQN - bQN;

      const aDur = a.service?.durationMinutes ?? 0;
      const bDur = b.service?.durationMinutes ?? 0;
      return aDur - bDur;
    });

    // 4. Update suggestedOrder and groupKey in DB
    for (let i = 0; i < sortedOrders.length; i++) {
      const order = sortedOrders[i];
      const suggestedOrder = i + 1;
      const groupKey = `${order.service?.performerType}-${order.service?.categoryId || 'none'}`;

      if (order.type === 'LAB') {
        await tx.labOrder.update({
          where: { id: order.id as string },
          data: {
            suggestedOrder,
            groupKey,
          } as Prisma.LabOrderUncheckedUpdateInput,
        });
      } else {
        await tx.visitServiceOrder.update({
          where: { id: order.id as string },
          data: {
            suggestedOrder,
            groupKey,
          } as Prisma.VisitServiceOrderUncheckedUpdateInput,
        });
      }
    }
  }

  private async recalculateTotals(tx: TransactionClient, invoiceId: string) {
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

  async findInvoiceDetailById(id: string): Promise<InvoiceDetailResult | null> {
    return (await this.prisma.invoice.findUnique({
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
    })) as unknown as InvoiceDetailResult | null;
  }

  async findInvoicesByBookingId(
    bookingId: string,
  ): Promise<InvoiceWithBooking[]> {
    return (await this.prisma.invoice.findMany({
      where: { bookingId },
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
                performer: { select: { id: true, fullName: true } },
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
    })) as unknown as InvoiceWithBooking[];
  }

  async findInvoicesPaginated(filter: {
    status?: InvoiceStatus;
    patientProfileId?: string;
    invoiceType?: InvoiceType;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ items: InvoiceWithBooking[]; total: number }> {
    const {
      status,
      patientProfileId,
      invoiceType,
      startDate,
      endDate,
      search,
      skip,
      take,
    } = filter;
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
      if (startDate) (where.createdAt as Prisma.DateTimeFilter).gte = startDate;
      if (endDate) (where.createdAt as Prisma.DateTimeFilter).lte = endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          items: {
            take: 1,
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
                  performer: { select: { id: true, fullName: true } },
                  service: {
                    include: { category: true },
                  },
                },
              },
            },
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
        take,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items: items as unknown as InvoiceWithBooking[], total };
  }

  async findInvoicesForExport(filter: {
    status?: InvoiceStatus;
    patientProfileId?: string;
    invoiceType?: InvoiceType;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<InvoiceWithBooking[]> {
    const {
      status,
      patientProfileId,
      invoiceType,
      startDate,
      endDate,
      search,
    } = filter;
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
      if (startDate) (where.createdAt as Prisma.DateTimeFilter).gte = startDate;
      if (endDate) (where.createdAt as Prisma.DateTimeFilter).lte = endDate;
    }

    return (await this.prisma.invoice.findMany({
      where,
      include: {
        booking: {
          include: {
            patientProfile: { select: { fullName: true, patientCode: true } },
          },
        },
        payments: {
          select: {
            amountPaid: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })) as unknown as InvoiceWithBooking[];
  }

  async findInvoicesInDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
  }

  async createInvoiceTransaction(params: CreateInvoiceInput): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const {
        bookingId,
        patientProfileId,
        invoiceType,
        invoiceNumber,
        notes,
        servicePrice,
        bookingService,
        labOrderIds,
        visitServiceOrderIds,
        items,
      } = params;

      const seedSubtotal =
        invoiceType === InvoiceType.CONSULTATION ? Number(servicePrice) : 0;

      const inv = await tx.invoice.create({
        data: {
          bookingId,
          patientProfileId,
          invoiceType,
          invoiceNumber,
          subtotal: seedSubtotal,
          discountAmount: 0,
          vatRate: 0,
          vatAmount: 0,
          taxAmount: 0,
          totalAmount: seedSubtotal,
          status: InvoiceStatus.DRAFT,
          notes,
        },
      });

      // For CONSULTATION: seed first item from booking service
      if (invoiceType === InvoiceType.CONSULTATION && bookingService) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: inv.id,
            serviceId: bookingService.id,
            itemName: bookingService.name,
            unitPrice: servicePrice,
            quantity: 1,
            totalPrice: servicePrice,
            sortOrder: 0,
          } as Prisma.InvoiceItemUncheckedCreateInput,
        });
      }

      let totalToUpdate = seedSubtotal;

      if (invoiceType === InvoiceType.SERVICE) {
        const labOrderWhere: Prisma.LabOrderWhereInput = {
          bookingId,
          status: LabOrderStatus.PENDING,
          invoiceItem: null,
        };
        if (labOrderIds && labOrderIds.length > 0) {
          labOrderWhere.id = { in: labOrderIds };
        }

        const pendingLabs = await tx.labOrder.findMany({
          where: labOrderWhere,
          orderBy: { createdAt: 'asc' },
          include: { service: { select: { price: true } } },
        });

        const vsoWhere: Prisma.VisitServiceOrderWhereInput = {
          bookingId,
          status: ServiceOrderStatus.PENDING,
          invoiceItem: null,
        };
        if (visitServiceOrderIds && visitServiceOrderIds.length > 0) {
          vsoWhere.id = { in: visitServiceOrderIds };
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
            } as Prisma.InvoiceItemUncheckedCreateInput,
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
            } as Prisma.InvoiceItemUncheckedCreateInput,
          });
          totalToUpdate += Number(item.totalPrice);
        }
      }

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const mItem = items[i];
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
            } as Prisma.InvoiceItemUncheckedCreateInput,
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
  }

  async syncLabInvoiceTransaction(params: {
    invoiceId: string;
    pendingLabs: SyncLabInvoiceOrderInput[];
    pendingVsos: SyncLabInvoiceVsoInput[];
  }): Promise<{ deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const { invoiceId, pendingLabs, pendingVsos } = params;

      const existingItems = await tx.invoiceItem.findMany({
        where: { invoiceId },
      });
      const existingLabOrderIds = existingItems
        .filter((it) => it.labOrderId)
        .map((it) => it.labOrderId);
      const existingVsoIds = existingItems
        .filter((it) => it.visitServiceOrderId)
        .map((it) => it.visitServiceOrderId)
        .filter(Boolean) as string[];

      for (const order of pendingLabs) {
        if (!existingLabOrderIds.includes(order.id)) {
          const price = order.service?.price ? Number(order.service.price) : 0;
          await tx.invoiceItem.create({
            data: {
              invoiceId,
              labOrderId: order.id,
              itemName: order.testName ?? 'Lab test',
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: 0,
            } as Prisma.InvoiceItemUncheckedCreateInput,
          });
        }
      }

      for (const vso of pendingVsos) {
        if (!existingVsoIds.includes(vso.id)) {
          const price = vso.service?.price ? Number(vso.service.price) : 0;
          await tx.invoiceItem.create({
            data: {
              invoiceId,
              visitServiceOrderId: vso.id,
              itemName: vso.service?.name ?? 'Clinical service',
              unitPrice: price,
              quantity: 1,
              totalPrice: price,
              sortOrder: 0,
            } as Prisma.InvoiceItemUncheckedCreateInput,
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
          item.visitServiceOrderId &&
          !currentPendingVsoIds.includes(item.visitServiceOrderId)
        ) {
          await tx.invoiceItem.delete({ where: { id: item.id } });
        }
      }

      const allItems = await tx.invoiceItem.findMany({
        where: { invoiceId },
      });

      const newTotal = allItems.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: newTotal,
          totalAmount: newTotal,
        },
      });

      if (allItems.length === 0) {
        const finalInvoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });
        if (finalInvoice && finalInvoice.status === InvoiceStatus.DRAFT) {
          await tx.invoice.delete({ where: { id: invoiceId } });
          return { deleted: true };
        }
      }

      return { deleted: false };
    });
  }

  async addInvoiceItemTransaction(params: {
    invoiceId: string;
    item: AddInvoiceItemInput;
    quantity: number;
    totalPrice: number;
  }): Promise<InvoiceItem> {
    return this.prisma.$transaction(async (tx) => {
      const { invoiceId, item, quantity, totalPrice } = params;
      const newItem = await tx.invoiceItem.create({
        data: {
          invoiceId,
          serviceId: item.serviceId,
          itemName: item.itemName,
          unitPrice: item.unitPrice,
          quantity,
          totalPrice,
          sortOrder: item.sortOrder ?? 0,
          labOrderId: item.labOrderId,
          visitServiceOrderId: item.visitServiceOrderId,
        } as Prisma.InvoiceItemUncheckedCreateInput,
      });

      await this.recalculateTotals(tx, invoiceId);
      return newItem;
    });
  }

  async removeInvoiceItemTransaction(
    invoiceId: string,
    itemId: string,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.delete({ where: { id: itemId } });
      await this.recalculateTotals(tx, invoiceId);
    });
  }

  async addPaymentTransaction(params: {
    invoiceId: string;
    input: RecordPaymentInput;
    confirmedByUserId: string;
    previouslyPaid: number;
    invoiceTotal: number;
    shouldAutoFinalize: boolean;
    patientPaid: number;
    insuranceCovered: number;
    invoiceType: InvoiceType;
    invoiceBookingId: string;
    currentBookingStatus?: BookingStatus | null;
    invoicePatientProfileUserId?: string | null;
    invoicePatientProfileFullName?: string | null;
    technicians: Array<{ id: string }>;
    onQueueAdd?: () => Promise<any>;
    generateQueueNumber: (prefix: string) => Promise<number>;
  }): Promise<{
    paidVsoIds: string[];
    broadcastPayload: {
      labOrderIds: string[];
      patientName: string;
      invoiceId: string;
    } | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const {
        invoiceId,
        input,
        confirmedByUserId,
        shouldAutoFinalize,
        patientPaid,
        insuranceCovered,
        invoiceType,
        invoiceBookingId,
        currentBookingStatus,
        invoicePatientProfileUserId,
        invoicePatientProfileFullName,
        technicians,
        onQueueAdd,
        generateQueueNumber,
      } = params;

      await tx.payment.create({
        data: {
          invoiceId,
          amountPaid: input.amountPaid,
          insuranceCovered,
          patientPaid: patientPaid < 0 ? 0 : patientPaid,
          paymentMethod: input.paymentMethod,
          insuranceNumber: input.insuranceNumber,
          transactionRef: input.transactionRef,
          confirmedBy: confirmedByUserId,
          notes: input.notes,
          paidAt: new Date(),
        },
      });

      let paidVsoIds: string[] = [];
      let broadcastPayload: {
        labOrderIds: string[];
        patientName: string;
        invoiceId: string;
      } | null = null;

      if (shouldAutoFinalize) {
        // We need to fetch existing payments to sum totalInsurance and totalPatient
        const payments = await tx.payment.findMany({
          where: { invoiceId },
        });

        // totalInsurance = previouslyPaid's insuranceCovered + this one
        const totalInsurance = payments.reduce(
          (sum, p) => sum + Number(p.insuranceCovered),
          0,
        );
        const totalPatient = payments.reduce(
          (sum, p) => sum + Number(p.patientPaid),
          0,
        );

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

        if (invoiceType === InvoiceType.SERVICE) {
          const paidItems = await tx.invoiceItem.findMany({
            where: { invoiceId },
          });

          const labOrderIds = paidItems
            .filter((i) => i.labOrderId)
            .map((i) => i.labOrderId as string);

          const vsoIds = paidItems
            .filter((i) => i.visitServiceOrderId)
            .map((i) => i.visitServiceOrderId as string);

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
              const startOfDayVal = new Date();
              startOfDayVal.setHours(0, 0, 0, 0);
              const dateStr = startOfDayVal
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, '');

              for (const vsoId of vsoIds) {
                const nextQueueNumber = await generateQueueNumber(
                  `QUEUE_VSO_${dateStr}`,
                );
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
            const startOfDayLab = new Date();
            startOfDayLab.setHours(0, 0, 0, 0);
            const dateStrLab = startOfDayLab
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, '');

            for (const labOrderId of labOrderIds) {
              const nextQueueNumber = await generateQueueNumber(
                `QUEUE_LAB_${dateStrLab}`,
              );
              await tx.labOrder.update({
                where: { id: labOrderId },
                data: {
                  queueNumber: nextQueueNumber,
                },
              });
            }

            // Calculate Smart Queue Suggested Order
            await this.assignSmartQueueOrder(tx, invoiceId);

            const patientName = invoicePatientProfileFullName || 'Khách';

            broadcastPayload = {
              labOrderIds,
              patientName,
              invoiceId,
            };

            const canTransitionToAwaiting =
              currentBookingStatus === BookingStatus.IN_PROGRESS ||
              currentBookingStatus === BookingStatus.CHECKED_IN;

            if (canTransitionToAwaiting) {
              await tx.booking.update({
                where: { id: invoiceBookingId },
                data: {
                  status: BookingStatus.AWAITING_RESULTS,
                },
              });
              await tx.bookingStatusHistory.create({
                data: {
                  bookingId: invoiceBookingId,
                  oldStatus: currentBookingStatus as BookingStatus,
                  newStatus: BookingStatus.AWAITING_RESULTS,
                  changedById: confirmedByUserId,
                  reason:
                    'LAB invoice paid — patient heading to procedure/lab room',
                },
              });

              await tx.medicalRecord.updateMany({
                where: { bookingId: invoiceBookingId },
                data: {
                  visitStep: VisitStep.AWAITING_RESULTS,
                },
              });
            }

            // Create notification records inside transaction
            for (const tech of technicians) {
              await tx.notification.create({
                data: {
                  userId: tech.id,
                  title: 'Phiếu xét nghiệm mới',
                  content: `Bệnh nhân ${patientName} đã thanh toán. Vui lòng thực hiện các chỉ định xét nghiệm.`,
                  type: 'SYSTEM',
                  channel: NotificationChannel.IN_APP,
                  metadata: {
                    invoiceId,
                    bookingId: invoiceBookingId,
                  } as Prisma.InputJsonValue,
                },
              });
            }

            if (invoicePatientProfileUserId) {
              await tx.notification.create({
                data: {
                  userId: invoicePatientProfileUserId,
                  title: 'Thanh toán xét nghiệm thành công',
                  content: `Thanh toán cho các chỉ định xét nghiệm đã được xác nhận. Vui lòng di chuyển đến khu vực cận lâm sàng.`,
                  type: 'SYSTEM',
                  channel: NotificationChannel.IN_APP,
                  metadata: {
                    bookingId: invoiceBookingId,
                  } as Prisma.InputJsonValue,
                },
              });
            }
          }
        }

        if (invoiceType === InvoiceType.CONSULTATION) {
          const consultItems = await tx.invoiceItem.findMany({
            where: { invoiceId },
          });

          const directVsoIds = consultItems
            .filter((i) => i.visitServiceOrderId)
            .map((i) => i.visitServiceOrderId as string);

          if (directVsoIds.length > 0) {
            const startOfDayVso = new Date();
            startOfDayVso.setHours(0, 0, 0, 0);
            const dateStrVso = startOfDayVso
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, '');

            for (const vsoId of directVsoIds) {
              const nextVsoQueueNumber = await generateQueueNumber(
                `QUEUE_VSO_${dateStrVso}`,
              );
              await tx.visitServiceOrder.update({
                where: { id: vsoId },
                data: {
                  status: ServiceOrderStatus.PAID,
                  paidAt: new Date(),
                  queueNumber: nextVsoQueueNumber,
                },
              });
            }

            paidVsoIds = [...paidVsoIds, ...directVsoIds];
          } else if (onQueueAdd) {
            // normal consultation referral
            await onQueueAdd();
          }
        }
      } else {
        // DRAFT -> OPEN
        const inv = await tx.invoice.findUnique({
          where: { id: invoiceId },
          select: { status: true },
        });
        if (inv && inv.status === InvoiceStatus.DRAFT) {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              status: InvoiceStatus.OPEN,
            },
          });
        }
      }

      if (input.labOrderId) {
        await tx.labOrder.update({
          where: { id: input.labOrderId },
          data: {
            status: LabOrderStatus.PAID,
          },
        });
      }

      return {
        paidVsoIds,
        broadcastPayload,
      };
    });
  }

  async findDraftInvoiceByType(
    bookingId: string,
    invoiceType: InvoiceType,
  ): Promise<Invoice | null> {
    return this.prisma.invoice.findFirst({
      where: {
        bookingId,
        invoiceType,
        status: InvoiceStatus.DRAFT,
      },
    });
  }

  async deleteInvoiceById(id: string): Promise<Invoice> {
    return this.prisma.invoice.delete({
      where: { id },
    });
  }

  async findInvoiceById(id: string): Promise<Invoice | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
    });
  }

  async findInvoiceDetailForPayment(
    id: string,
  ): Promise<InvoiceDetailForPaymentResult | null> {
    return (await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        booking: {
          include: {
            patientProfile: { select: { fullName: true, userId: true } },
            medicalRecord: true,
          },
        },
      },
    })) as unknown as InvoiceDetailForPaymentResult | null;
  }

  async findInvoiceDetailPostPayment(
    id: string,
  ): Promise<InvoiceDetailPostPaymentResult | null> {
    return (await this.prisma.invoice.findUnique({
      where: { id },
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
    })) as unknown as InvoiceDetailPostPaymentResult | null;
  }

  async findInvoiceDetailForFinalize(
    id: string,
  ): Promise<InvoiceDetailForFinalizeResult | null> {
    return (await this.prisma.invoice.findUnique({
      where: { id },
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
    })) as unknown as InvoiceDetailForFinalizeResult | null;
  }

  async finalizeInvoiceStatus(
    id: string,
    totalInsurance: number,
    totalPatient: number,
  ): Promise<InvoiceDetailPostPaymentResult> {
    return (await this.prisma.invoice.update({
      where: { id },
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
    })) as unknown as InvoiceDetailPostPaymentResult;
  }

  async findPaidInvoicesForAnalytics(filter: {
    gte?: Date;
    lte?: Date;
  }): Promise<
    Array<{
      totalAmount: Prisma.Decimal | number;
      paidAt: Date | null;
      doctorId: string | null;
    }>
  > {
    return this.prisma.invoice
      .findMany({
        where: {
          status: 'PAID',
          ...(filter.gte || filter.lte
            ? { paidAt: { gte: filter.gte, lte: filter.lte } }
            : {}),
        },
        select: {
          totalAmount: true,
          paidAt: true,
          booking: { select: { doctorId: true } },
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          totalAmount: r.totalAmount,
          paidAt: r.paidAt,
          doctorId: r.booking?.doctorId ?? null,
        })),
      );
  }

  async getRevenueByInvoiceType(filter: {
    gte?: Date;
    lte?: Date;
  }): Promise<
    Array<{ invoiceType: string; _sum: { totalAmount: number | null } }>
  > {
    const rows = await this.prisma.invoice.groupBy({
      by: ['invoiceType'],
      where: {
        status: 'PAID',
        ...(filter.gte || filter.lte
          ? { paidAt: { gte: filter.gte, lte: filter.lte } }
          : {}),
      },
      _sum: { totalAmount: true },
    } as never);

    return rows as Array<{
      invoiceType: string;
      _sum: { totalAmount: number | null };
    }>;
  }

  async findPaidInvoicesWithServiceInfo(filter: {
    gte?: Date;
    lte?: Date;
  }): Promise<
    Array<{
      totalAmount: Prisma.Decimal | number;
      booking: {
        serviceId: string | null;
        service: { name: string } | null;
      } | null;
    }>
  > {
    return (await this.prisma.invoice.findMany({
      where: {
        status: 'PAID',
        ...(filter.gte || filter.lte
          ? { paidAt: { gte: filter.gte, lte: filter.lte } }
          : {}),
      },
      include: {
        booking: {
          select: {
            serviceId: true,
            service: { select: { name: true } },
          },
        },
      },
    })) as unknown as Array<{
      totalAmount: Prisma.Decimal | number;
      booking: {
        serviceId: string | null;
        service: { name: string } | null;
      } | null;
    }>;
  }

  async findPaidInvoicesForReport(filter: { gte?: Date; lte?: Date }): Promise<
    Array<{
      id: string;
      invoiceNumber: string;
      invoiceType: string;
      totalAmount: Prisma.Decimal | number;
      paidAt: Date | null;
      booking: {
        patientProfile: { fullName: string; patientCode: string } | null;
        doctor: { fullName: string } | null;
      } | null;
      payments: Array<{ paymentMethod: string }>;
    }>
  > {
    return (await this.prisma.invoice.findMany({
      where: {
        status: 'PAID',
        ...(filter.gte || filter.lte
          ? { paidAt: { gte: filter.gte, lte: filter.lte } }
          : {}),
      },
      include: {
        booking: {
          select: {
            patientProfile: { select: { fullName: true, patientCode: true } },
            doctor: { select: { fullName: true } },
          },
        },
        payments: { select: { paymentMethod: true } },
      },
      orderBy: { paidAt: 'desc' },
    })) as unknown as Array<{
      id: string;
      invoiceNumber: string;
      invoiceType: string;
      totalAmount: Prisma.Decimal | number;
      paidAt: Date | null;
      booking: {
        patientProfile: { fullName: string; patientCode: string } | null;
        doctor: { fullName: string } | null;
      } | null;
      payments: Array<{ paymentMethod: string }>;
    }>;
  }

  async getRevenueGroupByType(filter: {
    gte: Date;
    lte?: Date;
  }): Promise<Array<{ invoiceType: string; totalAmount: number }>> {
    const rows = await this.prisma.invoice.groupBy({
      by: ['invoiceType'],
      where: {
        status: 'PAID',
        paidAt: { gte: filter.gte, lte: filter.lte },
      },
      _sum: { totalAmount: true },
    } as never);

    return (
      rows as Array<{
        invoiceType: string;
        _sum: { totalAmount: number | null };
      }>
    ).map((r) => ({
      invoiceType: r.invoiceType,
      totalAmount: Number(r._sum?.totalAmount ?? 0),
    }));
  }

  async getPatientRevenueStats(
    patientProfileId: string,
    gte?: Date,
  ): Promise<number> {
    const agg = await this.prisma.invoice.aggregate({
      where: {
        patientProfileId,
        status: 'PAID',
        ...(gte ? { paidAt: { gte } } : {}),
      },
      _sum: {
        totalAmount: true,
      },
    });
    return Number(agg._sum?.totalAmount ?? 0);
  }

  async getDoctorConsultationRevenue(
    doctorId: string,
    gteDate: Date,
    lteDate?: Date,
  ): Promise<number> {
    const agg = await this.prisma.invoice.aggregate({
      where: {
        booking: { doctorId },
        status: 'PAID',
        invoiceType: 'CONSULTATION',
        paidAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
      _sum: {
        totalAmount: true,
      },
    });
    return Number(agg._sum?.totalAmount ?? 0);
  }

  async getTotalPaidRevenue(gteDate: Date, lteDate?: Date): Promise<number> {
    const agg = await this.prisma.invoice.aggregate({
      where: {
        status: 'PAID',
        paidAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
      _sum: {
        totalAmount: true,
      },
    });
    return Number(agg._sum?.totalAmount ?? 0);
  }

  async countInvoicesByStatusAndDateRange(
    statuses: InvoiceStatus[],
    gteDate: Date,
    lteDate?: Date,
  ): Promise<number> {
    return this.prisma.invoice.count({
      where: {
        status: { in: statuses },
        createdAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
    });
  }

  async groupByPaymentMethod(
    gteDate: Date,
    lteDate?: Date,
  ): Promise<
    Array<{
      paymentMethod: string;
      _sum: { amountPaid: number };
      _count: { _all: number };
    }>
  > {
    const rows = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: {
        createdAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
      _sum: {
        amountPaid: true,
      },
      _count: {
        _all: true,
      },
    });

    return rows.map((r) => ({
      paymentMethod: r.paymentMethod,
      _sum: { amountPaid: Number(r._sum?.amountPaid ?? 0) },
      _count: { _all: r._count?._all ?? 0 },
    }));
  }

  async getTopBookingIdsByPaidRevenue(
    gteDate: Date,
    lteDate: Date | undefined,
    limit: number,
  ): Promise<Array<{ bookingId: string; totalAmount: number }>> {
    const rows = await this.prisma.invoice.groupBy({
      by: ['bookingId'],
      where: {
        status: InvoiceStatus.PAID,
        paidAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: limit,
    });

    const typedRows = rows as unknown as Array<{
      bookingId: string | null;
      _sum: { totalAmount: Prisma.Decimal | null };
    }>;

    return typedRows
      .filter((r) => r.bookingId !== null)
      .map((r) => ({
        bookingId: r.bookingId as string,
        totalAmount: Number(r._sum?.totalAmount ?? 0),
      }));
  }
}
