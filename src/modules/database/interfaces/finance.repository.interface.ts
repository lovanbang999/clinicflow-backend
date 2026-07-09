import {
  Invoice,
  InvoiceItem,
  Payment,
  Prisma,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  BookingStatus,
} from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';
import {
  InvoiceDetailResult,
  InvoiceWithBooking,
  InvoiceDetailForPaymentResult,
  InvoiceDetailPostPaymentResult,
  InvoiceDetailForFinalizeResult,
} from '../types/prisma-payload.types';

export {
  InvoiceDetailResult,
  InvoiceWithBooking,
  InvoiceDetailForPaymentResult,
  InvoiceDetailPostPaymentResult,
  InvoiceDetailForFinalizeResult,
};

export const I_FINANCE_REPOSITORY = 'IFinanceRepository';

export interface CreateInvoiceInput {
  bookingId: string;
  patientProfileId: string;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  notes?: string;
  servicePrice: number;
  bookingService?: { id: string; name: string } | null;
  labOrderIds?: string[];
  visitServiceOrderIds?: string[];
  items?: Array<{
    serviceId?: string;
    itemName: string;
    unitPrice: number;
    quantity?: number;
    sortOrder?: number;
  }>;
}

export interface SyncLabInvoiceOrderInput {
  id: string;
  testName?: string | null;
  service?: { price: number | Prisma.Decimal | null } | null;
}

export interface SyncLabInvoiceVsoInput {
  id: string;
  service?: { price: number | Prisma.Decimal | null; name: string } | null;
}

export interface AddInvoiceItemInput {
  serviceId?: string;
  itemName: string;
  unitPrice: number;
  quantity?: number;
  sortOrder?: number;
  labOrderId?: string;
  visitServiceOrderId?: string;
}

export interface RecordPaymentInput {
  paymentMethod: PaymentMethod;
  amountPaid: number;
  insuranceCovered?: number;
  transactionRef?: string;
  insuranceNumber?: string;
  labOrderId?: string;
  notes?: string;
}

export interface IFinanceRepository {
  countInvoice(args: Prisma.InvoiceCountArgs): Promise<number>;
  findFirstInvoice<T extends Prisma.InvoiceFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceFindFirstArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T> | null>;
  findManyInvoice<T extends Prisma.InvoiceFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceFindManyArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T>[]>;
  findUniqueInvoice<T extends Prisma.InvoiceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceFindUniqueArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T> | null>;
  updateInvoice<T extends Prisma.InvoiceUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceUpdateArgs>,
  ): Promise<Prisma.InvoiceGetPayload<T>>;
  createInvoice(args: Prisma.InvoiceCreateArgs): Promise<Invoice>;
  deleteInvoice(args: Prisma.InvoiceDeleteArgs): Promise<Invoice>;
  groupByInvoice(args: Prisma.InvoiceGroupByArgs): Promise<unknown[]>;
  aggregateInvoice(
    args: Prisma.InvoiceAggregateArgs,
  ): Promise<Prisma.GetInvoiceAggregateType<Prisma.InvoiceAggregateArgs>>;

  countInvoiceItem(args: Prisma.InvoiceItemCountArgs): Promise<number>;
  findFirstInvoiceItem<T extends Prisma.InvoiceItemFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceItemFindFirstArgs>,
  ): Promise<Prisma.InvoiceItemGetPayload<T> | null>;
  findManyInvoiceItem<T extends Prisma.InvoiceItemFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceItemFindManyArgs>,
  ): Promise<Prisma.InvoiceItemGetPayload<T>[]>;
  findUniqueInvoiceItem<T extends Prisma.InvoiceItemFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvoiceItemFindUniqueArgs>,
  ): Promise<Prisma.InvoiceItemGetPayload<T> | null>;
  updateInvoiceItem(args: Prisma.InvoiceItemUpdateArgs): Promise<InvoiceItem>;
  createInvoiceItem(args: Prisma.InvoiceItemCreateArgs): Promise<InvoiceItem>;
  deleteInvoiceItem(args: Prisma.InvoiceItemDeleteArgs): Promise<InvoiceItem>;

  countPayment(args: Prisma.PaymentCountArgs): Promise<number>;
  findFirstPayment<T extends Prisma.PaymentFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.PaymentFindFirstArgs>,
  ): Promise<Prisma.PaymentGetPayload<T> | null>;
  findManyPayment<T extends Prisma.PaymentFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.PaymentFindManyArgs>,
  ): Promise<Prisma.PaymentGetPayload<T>[]>;
  findUniquePayment<T extends Prisma.PaymentFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PaymentFindUniqueArgs>,
  ): Promise<Prisma.PaymentGetPayload<T> | null>;
  updatePayment(args: Prisma.PaymentUpdateArgs): Promise<Payment>;
  createPayment(args: Prisma.PaymentCreateArgs): Promise<Payment>;
  deletePayment(args: Prisma.PaymentDeleteArgs): Promise<Payment>;
  groupByPayment(args: Prisma.PaymentGroupByArgs): Promise<unknown[]>;

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;

  // Business-oriented query and transaction methods
  findInvoiceDetailById(id: string): Promise<InvoiceDetailResult | null>;
  findInvoicesByBookingId(bookingId: string): Promise<InvoiceWithBooking[]>;
  findInvoicesPaginated(filter: {
    status?: InvoiceStatus;
    patientProfileId?: string;
    invoiceType?: InvoiceType;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ items: InvoiceWithBooking[]; total: number }>;
  findInvoicesForExport(filter: {
    status?: InvoiceStatus;
    patientProfileId?: string;
    invoiceType?: InvoiceType;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<InvoiceWithBooking[]>;
  findInvoicesInDateRange(startDate: Date, endDate: Date): Promise<Invoice[]>;

  createInvoiceTransaction(params: CreateInvoiceInput): Promise<Invoice>;

  syncLabInvoiceTransaction(params: {
    invoiceId: string;
    pendingLabs: SyncLabInvoiceOrderInput[];
    pendingVsos: SyncLabInvoiceVsoInput[];
  }): Promise<{ deleted: boolean }>;

  addInvoiceItemTransaction(params: {
    invoiceId: string;
    item: AddInvoiceItemInput;
    quantity: number;
    totalPrice: number;
  }): Promise<InvoiceItem>;

  removeInvoiceItemTransaction(
    invoiceId: string,
    itemId: string,
  ): Promise<void>;

  addPaymentTransaction(params: {
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
  }>;

  findDraftInvoiceByType(
    bookingId: string,
    invoiceType: InvoiceType,
  ): Promise<Invoice | null>;
  deleteInvoiceById(id: string): Promise<Invoice>;
  findInvoiceById(id: string): Promise<Invoice | null>;
  findInvoiceDetailForPayment(
    id: string,
  ): Promise<InvoiceDetailForPaymentResult | null>;
  findInvoiceDetailPostPayment(
    id: string,
  ): Promise<InvoiceDetailPostPaymentResult | null>;
  findInvoiceDetailForFinalize(
    id: string,
  ): Promise<InvoiceDetailForFinalizeResult | null>;
  finalizeInvoiceStatus(
    id: string,
    totalInsurance: number,
    totalPatient: number,
  ): Promise<InvoiceDetailPostPaymentResult>;

  // Analytics-oriented methods
  findPaidInvoicesForAnalytics(filter: { gte?: Date; lte?: Date }): Promise<
    Array<{
      totalAmount: Prisma.Decimal | number;
      paidAt: Date | null;
      doctorId: string | null;
    }>
  >;

  getRevenueByInvoiceType(filter: {
    gte?: Date;
    lte?: Date;
  }): Promise<
    Array<{ invoiceType: string; _sum: { totalAmount: number | null } }>
  >;

  findPaidInvoicesWithServiceInfo(filter: { gte?: Date; lte?: Date }): Promise<
    Array<{
      totalAmount: Prisma.Decimal | number;
      booking: {
        serviceId: string | null;
        service: { name: string } | null;
      } | null;
    }>
  >;

  findPaidInvoicesForReport(filter: { gte?: Date; lte?: Date }): Promise<
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
  >;

  getRevenueGroupByType(filter: {
    gte: Date;
    lte?: Date;
  }): Promise<Array<{ invoiceType: string; totalAmount: number }>>;
  getPatientRevenueStats(patientProfileId: string, gte?: Date): Promise<number>;
  getDoctorConsultationRevenue(
    doctorId: string,
    gteDate: Date,
    lteDate?: Date,
  ): Promise<number>;
  getTotalPaidRevenue(gteDate: Date, lteDate?: Date): Promise<number>;
  countInvoicesByStatusAndDateRange(
    statuses: InvoiceStatus[],
    gteDate: Date,
    lteDate?: Date,
  ): Promise<number>;
  groupByPaymentMethod(
    gteDate: Date,
    lteDate?: Date,
  ): Promise<
    Array<{
      paymentMethod: string;
      _sum: { amountPaid: number };
      _count: { _all: number };
    }>
  >;
  getTopBookingIdsByPaidRevenue(
    gteDate: Date,
    lteDate: Date | undefined,
    limit: number,
  ): Promise<Array<{ bookingId: string; totalAmount: number }>>;
}
