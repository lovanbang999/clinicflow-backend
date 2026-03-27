import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, UserRole } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { GetRevenueChartQueryDto } from './dto/get-revenue-chart.query.dto';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchPaidInvoices(filter: { gte?: Date; lte?: Date }) {
    return this.prisma.invoice.findMany({
      where: {
        status: 'PAID',
        ...(filter.gte || filter.lte
          ? { paidAt: { gte: filter.gte, lte: filter.lte } }
          : {}),
      },
      select: {
        totalAmount: true,
        paidAt: true,
        booking: {
          select: { doctorId: true },
        },
      },
    });
  }

  async getDashboardOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const monthPaidInvoices = await this.fetchPaidInvoices({
      gte: startOfMonth,
    });

    const doctorRevenue = new Map<string, number>();

    for (const inv of monthPaidInvoices) {
      const dId = inv.booking.doctorId;
      doctorRevenue.set(
        dId,
        (doctorRevenue.get(dId) || 0) + Number(inv.totalAmount),
      );
    }
    const [
      totalPatients,
      totalDoctors,
      totalBookings,
      currentMonthPatients,
      lastMonthPatients,
    ] = await Promise.all([
      // v3.0: count PatientProfile to include both registered and guest patients
      this.prisma.patientProfile.count(),
      this.prisma.user.count({
        where: { role: UserRole.DOCTOR, isActive: true },
      }),
      this.prisma.booking.count(),
      // New patient profiles this month (registered + guest)
      this.prisma.patientProfile.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      // New patient profiles last month (for trend)
      this.prisma.patientProfile.count({
        where: {
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),
    ]);

    // Revenue: SUM(totalAmount) of all PAID invoices
    const allPaid = await this.fetchPaidInvoices({});
    const totalRevenue = allPaid.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    // This month's bookings (for trend)
    const currentMonthBookings = await this.prisma.booking.count({
      where: { createdAt: { gte: startOfMonth } },
    });
    const lastMonthBookings = await this.prisma.booking.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    });

    // Month-on-month revenue (based on paidAt)
    const currentMonthRevenue = allPaid
      .filter((inv) => inv.paidAt && inv.paidAt >= startOfMonth)
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const lastMonthRevenue = allPaid
      .filter(
        (inv) =>
          inv.paidAt &&
          inv.paidAt >= startOfLastMonth &&
          inv.paidAt < startOfMonth,
      )
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    const revenueGrowthPct =
      lastMonthRevenue > 0
        ? Math.round(
            ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100,
          )
        : 0;

    return ResponseHelper.success(
      {
        totalUsers: totalPatients,
        totalDoctors,
        totalBookings,
        totalRevenue,
        trends: {
          newPatientsThisMonth: currentMonthPatients,
          newPatientsLastMonth: lastMonthPatients,
          newBookingsThisMonth: currentMonthBookings,
          newBookingsLastMonth: lastMonthBookings,
          currentMonthRevenue,
          lastMonthRevenue,
          revenueGrowthPct,
        },
      },
      'ADMIN.DASHBOARD.OVERVIEW',
      'Dashboard overview retrieved successfully',
      200,
    );
  }

  // GET /admin/dashboard/monthly-stats?month=YYYY-MM
  // Panel: bookingCount, newPatients, successRate, revenue
  async getMonthlyStats(month?: string) {
    let year: number, monthIndex: number;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthIndex = m - 1;
    } else {
      const now = new Date();
      year = now.getFullYear();
      monthIndex = now.getMonth();
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59);

    const [bookingCount, completedCount, newPatients] = await Promise.all([
      this.prisma.booking.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.COMPLETED,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.PATIENT,
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    const paidInvoices = await this.fetchPaidInvoices({
      gte: start,
      lte: end,
    });
    const revenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const successRate =
      bookingCount > 0 ? Math.round((completedCount / bookingCount) * 100) : 0;

    return ResponseHelper.success(
      {
        month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        bookingCount,
        newPatients,
        successRate,
        revenue,
      },
      'ADMIN.DASHBOARD.MONTHLY_STATS',
      'Monthly statistics retrieved successfully',
      200,
    );
  }

  // GET /admin/dashboard/top-doctors?limit=5
  // Panel: top doctors ranked by revenue from PAID invoices this month
  async getTopDoctors(limit: number = 5) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const topRaw = await this.prisma.invoice.groupBy({
      by: ['bookingId'],
      where: {
        status: 'PAID',
        paidAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit * 2, // Take more to account for multiple invoices per doctor
    });

    // We need to map bookingId back to doctorId
    const bookingIds = topRaw.map((r) => r.bookingId);

    const doctorRevenueMap = new Map<string, number>();
    const doctorCountMap = new Map<string, number>();
    const doctorInfoMap = new Map<
      string,
      { fullName: string; avatar: string | null; specialties: string[] }
    >();

    // Re-fetch bookings with doctor profile to get specialties
    const bookingsWithProfiles = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        id: true,
        doctorId: true,
        doctor: {
          select: {
            fullName: true,
            avatar: true,
            doctorProfile: { select: { specialties: true } },
          },
        },
      },
    });

    for (const row of topRaw) {
      const booking = bookingsWithProfiles.find((b) => b.id === row.bookingId);
      if (booking) {
        const dId = booking.doctorId;
        doctorRevenueMap.set(
          dId,
          (doctorRevenueMap.get(dId) || 0) + Number(row._sum.totalAmount),
        );
        doctorCountMap.set(dId, (doctorCountMap.get(dId) || 0) + 1);

        if (!doctorInfoMap.has(dId)) {
          doctorInfoMap.set(dId, {
            fullName: booking.doctor.fullName,
            avatar: booking.doctor.avatar,
            specialties: booking.doctor.doctorProfile?.specialties || [],
          });
        }
      }
    }

    const topDoctors = Array.from(doctorRevenueMap.entries())
      .map(([id, revenue]) => {
        const info = doctorInfoMap.get(id);
        const specialties = info?.specialties || [];
        return {
          id,
          name: info?.fullName ?? 'Unknown',
          avatar: info?.avatar ?? null,
          specialty: specialties.length > 0 ? specialties[0] : 'General',
          patientsCount: doctorCountMap.get(id) || 0,
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return ResponseHelper.success(
      { topDoctors },
      'ADMIN.DASHBOARD.TOP_DOCTORS',
      'Top doctors retrieved successfully',
      200,
    );
  }

  // GET /admin/dashboard/revenue-chart
  // Supporting period: 'week', 'month', 'quarter' OR months count
  async getRevenueChart(query: GetRevenueChartQueryDto) {
    const { months = 6, period = 'month' } = query;
    const now = new Date();
    let since: Date;
    let isDaily = false;
    let points = 6;

    if (period === 'week') {
      since = new Date(now);
      since.setDate(now.getDate() - 6); // Last 7 days including today
      since.setHours(0, 0, 0, 0);
      isDaily = true;
      points = 7;
    } else if (period === 'month') {
      since = new Date(now);
      since.setDate(now.getDate() - 29); // Last 30 days
      since.setHours(0, 0, 0, 0);
      isDaily = true;
      points = 30;
    } else if (period === 'quarter') {
      since = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      since.setHours(0, 0, 0, 0);
      isDaily = false;
      points = 3;
    } else {
      // Manual month count
      since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      since.setHours(0, 0, 0, 0);
      isDaily = false;
      points = months;
    }

    const paidInvoices = await this.fetchPaidInvoices({
      gte: since,
    });

    const revenueByPoint = new Map<string, number>();

    if (isDaily) {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(since);
        d.setDate(since.getDate() + (points - 1 - i));
        const key = d.toISOString().split('T')[0];
        revenueByPoint.set(key, 0);
      }
    } else {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        revenueByPoint.set(key, 0);
      }
    }

    for (const inv of paidInvoices) {
      let key: string;
      if (!inv.paidAt) continue;

      if (isDaily) {
        key = inv.paidAt.toISOString().split('T')[0];
      } else {
        key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`;
      }

      if (revenueByPoint.has(key)) {
        revenueByPoint.set(
          key,
          revenueByPoint.get(key)! + Number(inv.totalAmount),
        );
      }
    }

    const chart = Array.from(revenueByPoint.entries()).map(
      ([point, revenue]) => ({
        date: isDaily ? point : `${point}-01`,
        revenue,
      }),
    );

    return ResponseHelper.success(
      { period, months: isDaily ? undefined : months, chart },
      'ADMIN.DASHBOARD.REVENUE_CHART',
      'Revenue chart data retrieved successfully',
      200,
    );
  }

  // GET /admin/dashboard/booking-overview
  // Panel: completed / upcoming / cancelled / total counts
  async getBookingOverview() {
    const now = new Date();

    const [total, completed, upcoming, cancelled, inProgress] =
      await Promise.all([
        this.prisma.booking.count(),
        this.prisma.booking.count({
          where: { status: BookingStatus.COMPLETED },
        }),
        this.prisma.booking.count({
          where: {
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            bookingDate: { gte: now },
          },
        }),
        this.prisma.booking.count({
          where: { status: BookingStatus.CANCELLED },
        }),
        this.prisma.booking.count({
          where: {
            status: {
              in: [BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS],
            },
          },
        }),
      ]);

    return ResponseHelper.success(
      {
        total,
        completed,
        upcoming,
        cancelled,
        inProgress,
        completedPct: total > 0 ? Math.round((completed / total) * 100) : 0,
        upcomingPct: total > 0 ? Math.round((upcoming / total) * 100) : 0,
        cancelledPct: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      },
      'ADMIN.DASHBOARD.BOOKING_OVERVIEW',
      'Booking overview retrieved successfully',
      200,
    );
  }

  // GET /admin/dashboard/top-services?limit=5
  // Panel: top services by revenue from PAID invoices this month
  async getTopServices(limit: number = 5) {
    const startOfThisMonth = new Date();
    startOfThisMonth.setDate(1);
    startOfThisMonth.setHours(0, 0, 0, 0);

    // Sum totalAmount from PAID invoices grouped by booked service
    const topInvoices = await this.prisma.invoice.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: startOfThisMonth },
      },
      include: {
        booking: {
          select: {
            serviceId: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    const serviceRevenueMap = new Map<
      string,
      { name: string; revenue: number; count: number }
    >();

    for (const inv of topInvoices) {
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
        bookingsCount: data.count,
        estimatedRevenue: data.revenue,
      }))
      .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
      .slice(0, limit);

    return ResponseHelper.success(
      { topServices },
      'ADMIN.DASHBOARD.TOP_SERVICES',
      'Top services retrieved successfully',
      200,
    );
  }
}
