import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, InvoiceStatus } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { DateRangeQueryDto } from '../../admin/analytics/dto/date-range.query.dto';

@Injectable()
export class ReceptionistAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [totalRevenueRaw, checkIns, newPatients, pendingInvoices] =
      await Promise.all([
        // Total Paid Revenue in period
        this.prisma.invoice.aggregate({
          where: {
            status: InvoiceStatus.PAID,
            paidAt: { gte: filterGte, lte: filterLte },
          },
          _sum: { totalAmount: true },
        }),
        // Successful Check-ins
        this.prisma.booking.count({
          where: {
            status: {
              in: [
                BookingStatus.CHECKED_IN,
                BookingStatus.IN_PROGRESS,
                BookingStatus.COMPLETED,
              ],
            },
            checkedInAt: { gte: filterGte, lte: filterLte },
          },
        }),
        // New Patients registered
        this.prisma.patientProfile.count({
          where: {
            createdAt: { gte: filterGte, lte: filterLte },
          },
        }),
        // Pending/Draft Invoices
        this.prisma.invoice.count({
          where: {
            status: {
              in: [
                InvoiceStatus.DRAFT,
                InvoiceStatus.OPEN,
                InvoiceStatus.ISSUED,
              ],
            },
            createdAt: { gte: filterGte, lte: filterLte },
          },
        }),
      ]);

    return ResponseHelper.success(
      {
        totalRevenue: Number(totalRevenueRaw._sum.totalAmount || 0),
        checkIns,
        newPatients,
        pendingInvoices,
      },
      'RECEPTIONIST.ANALYTICS.OVERVIEW',
      'Receptionist overview stats retrieved successfully',
      200,
    );
  }

  async getRevenueTrend(query: DateRangeQueryDto) {
    const { from, to } = query;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    const filterGte = from ? new Date(from) : weekAgo;
    const filterLte = to ? new Date(to) : undefined;

    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PAID,
        paidAt: { gte: filterGte, lte: filterLte },
      },
      select: {
        totalAmount: true,
        paidAt: true,
      },
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

    return ResponseHelper.success(
      { chart },
      'RECEPTIONIST.ANALYTICS.REVENUE_TREND',
      'Revenue trend retrieved successfully',
      200,
    );
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
    ] = await Promise.all([
      // Booking Sources
      this.prisma.booking.groupBy({
        by: ['source'],
        where: { createdAt: { gte: filterGte, lte: filterLte } },
        _count: { _all: true },
      }),
      // Appointment Statuses
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { createdAt: { gte: filterGte, lte: filterLte } },
        _count: { _all: true },
      }),
      // Payment Methods
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: { createdAt: { gte: filterGte, lte: filterLte } },
        _sum: { amountPaid: true },
        _count: { _all: true },
      }),
      // Top Services (Revenue Based)
      this.prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: filterGte, lte: filterLte },
        },
        include: {
          booking: {
            select: {
              serviceId: true,
              service: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const serviceRevenueMap = new Map<
      string,
      { name: string; revenue: number; count: number }
    >();

    for (const inv of topServicesRaw) {
      if (!inv.booking?.serviceId) continue;

      const sId = inv.booking.serviceId;
      const sName = inv.booking.service.name;
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

    return ResponseHelper.success(
      {
        bookingSources: bookingSources.map((s) => ({
          label: s.source,
          value: s._count._all,
        })),
        appointmentStatuses: appointmentStatuses.map((s) => ({
          label: s.status,
          value: s._count._all,
        })),
        paymentMethods: paymentMethods.map((p) => ({
          label: p.paymentMethod,
          value: Number(p._sum?.amountPaid || 0),
          count: p._count?._all || 0,
        })),
        topServices,
      },
      'RECEPTIONIST.ANALYTICS.OPERATIONAL',
      'Operational stats retrieved successfully',
      200,
    );
  }
}
