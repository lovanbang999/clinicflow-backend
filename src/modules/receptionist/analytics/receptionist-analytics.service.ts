import { Injectable, Inject } from '@nestjs/common';
import {
  I_FINANCE_REPOSITORY,
  IFinanceRepository,
} from '../../database/interfaces/finance.repository.interface';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../database/interfaces/booking.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../../database/interfaces/profile.repository.interface';
import { InvoiceStatus, Prisma } from '@prisma/client';

import { DateRangeQueryDto } from '../../admin/analytics/dto/date-range.query.dto';

@Injectable()
export class ReceptionistAnalyticsService {
  constructor(
    @Inject(I_FINANCE_REPOSITORY)
    private readonly financeRepository: IFinanceRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  async getOverview(query: DateRangeQueryDto) {
    const { from, to } = query;
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const filterGte = from ? new Date(from) : startOfDay;
    const filterLte = to ? new Date(to) : undefined;

    const [
      totalRevenue,
      checkIns,
      newPatients,
      pendingInvoices,
      revenueByCategoryRaw,
    ] = (await Promise.all([
      // Total Paid Revenue in period
      this.financeRepository.getTotalPaidRevenue(filterGte, filterLte),
      // Successful Check-ins
      this.bookingRepository.countCheckInsForDateRange(filterGte, filterLte),
      // New Patients registered
      this.profileRepository.countPatientsByDateRange(filterGte, filterLte),
      // Pending/Draft Invoices
      this.financeRepository.countInvoicesByStatusAndDateRange(
        [InvoiceStatus.DRAFT, InvoiceStatus.OPEN, InvoiceStatus.ISSUED],
        filterGte,
        filterLte,
      ),
      // Revenue by category
      this.financeRepository.getRevenueByInvoiceType({
        gte: filterGte,
        lte: filterLte,
      }),
    ])) as [
      number,
      number,
      number,
      number,
      Array<{ invoiceType: string; _sum: { totalAmount: number | null } }>,
    ];

    const revenueByCategory = {
      CONSULTATION: 0,
      SERVICE: 0,
      PHARMACY: 0,
    };

    if (Array.isArray(revenueByCategoryRaw)) {
      revenueByCategoryRaw.forEach((row) => {
        if (row && row.invoiceType && row._sum?.totalAmount) {
          const type = row.invoiceType as keyof typeof revenueByCategory;
          if (type in revenueByCategory) {
            revenueByCategory[type] = Number(row._sum.totalAmount);
          }
        }
      });
    }

    return {
      totalRevenue,
      checkIns,
      newPatients,
      pendingInvoices,
      revenueByCategory,
    };
  }

  async getRevenueTrend(query: DateRangeQueryDto) {
    const { from, to } = query;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    const filterGte = from ? new Date(from) : weekAgo;
    const filterLte = to ? new Date(to) : undefined;

    const paidInvoices =
      await this.financeRepository.findPaidInvoicesForAnalytics({
        gte: filterGte,
        lte: filterLte,
      });

    // Group by date
    const revenueByDate = new Map<string, number>();

    // Initialize dates in range
    const targetEnd = filterLte || now;
    const daysDiff = Math.ceil(
      (targetEnd.getTime() - filterGte.getTime()) / (1000 * 60 * 60 * 24),
    );

    for (let i = 0; i <= Math.min(daysDiff, 31); i++) {
      const d = new Date(filterGte);
      d.setDate(filterGte.getDate() + i);
      if (d > targetEnd) break;
      revenueByDate.set(d.toISOString().split('T')[0], 0);
    }

    paidInvoices.forEach((inv) => {
      if (inv.paidAt) {
        const key = inv.paidAt.toISOString().split('T')[0];
        if (revenueByDate.has(key)) {
          revenueByDate.set(
            key,
            revenueByDate.get(key)! + Number(inv.totalAmount),
          );
        }
      }
    });

    const chart = Array.from(revenueByDate.entries()).map(
      ([date, revenue]) => ({
        date,
        revenue,
      }),
    );

    return { chart };
  }

  async getOperationalStats(query: DateRangeQueryDto) {
    const { from, to } = query;
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const filterGte = from ? new Date(from) : startOfDay;
    const filterLte = to ? new Date(to) : undefined;

    const [
      bookingSources,
      appointmentStatuses,
      paymentMethods,
      topServicesRaw,
    ] = (await Promise.all([
      // Booking Sources
      this.bookingRepository.getBookingCountBySource(filterGte, filterLte),
      // Appointment Statuses
      this.bookingRepository.getBookingCountByStatus(filterGte, filterLte),
      // Payment Methods
      this.financeRepository.groupByPaymentMethod(filterGte, filterLte),
      // Top Services (Revenue Based)
      this.financeRepository.findPaidInvoicesWithServiceInfo({
        gte: filterGte,
        lte: filterLte,
      }),
    ])) as [
      Array<{ source: string; count: number }>,
      Array<{ status: string; count: number }>,
      Array<{
        paymentMethod: string;
        _sum: { amountPaid: number };
        _count: { _all: number };
      }>,
      Array<{
        totalAmount: Prisma.Decimal | number;
        booking: {
          serviceId: string | null;
          service: { name: string } | null;
        } | null;
      }>,
    ];

    const serviceRevenueMap = new Map<
      string,
      { name: string; revenue: number; count: number }
    >();

    for (const inv of topServicesRaw) {
      if (!inv.booking?.serviceId) continue;

      const sId = inv.booking.serviceId;
      const sName = inv.booking.service?.name ?? 'Chưa xác định';
      const amount = Number(inv.totalAmount);

      const existing = serviceRevenueMap.get(sId) || {
        name: sName,
        revenue: 0,
        count: 0,
      };
      serviceRevenueMap.set(sId, {
        name: sName,
        revenue: existing.revenue + amount,
        count: existing.count + 1,
      });
    }

    const topServices = Array.from(serviceRevenueMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      bookingSources: bookingSources.map((s) => ({
        label: s.source,
        value: s.count,
      })),
      appointmentStatuses: appointmentStatuses.map((s) => ({
        label: s.status,
        value: s.count,
      })),
      paymentMethods: paymentMethods.map((p) => ({
        label: p.paymentMethod,
        value: p._sum.amountPaid,
        count: p._count._all,
      })),
      topServices,
    };
  }
}
