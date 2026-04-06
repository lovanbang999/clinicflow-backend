import { Injectable } from '@nestjs/common';
import { Invoice, InvoiceItem, Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IFinanceRepository } from '../interfaces/finance.repository.interface';
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
}
