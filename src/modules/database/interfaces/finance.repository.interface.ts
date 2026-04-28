import { Invoice, InvoiceItem, Payment, Prisma } from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';

export const I_FINANCE_REPOSITORY = 'IFinanceRepository';

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
}
