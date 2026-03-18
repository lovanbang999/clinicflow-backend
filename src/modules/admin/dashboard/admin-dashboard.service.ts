import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, UserRole } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchCompletedBookingsWithPrice(filter: {
    gte?: Date;
    lte?: Date;
  }) {
    return this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        ...(filter.gte || filter.lte
          ? { createdAt: { gte: filter.gte, lte: filter.lte } }
          : {}),
      },
      select: {
        service: { select: { price: true } },
        createdAt: true,
        doctorId: true,
      },
    });
  }

  async getDashboardOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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

    // Revenue: SUM(service.price) of all COMPLETED bookings
    const allCompleted = await this.fetchCompletedBookingsWithPrice({});
    const totalRevenue = allCompleted.reduce(
      (sum, b) => sum + Number(b.service.price),
      0,
    );

    // This month's bookings (for trend)
    const currentMonthBookings = await this.prisma.booking.count({
      where: { createdAt: { gte: startOfMonth } },
    });
    const lastMonthBookings = await this.prisma.booking.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    });

    // Month-on-month revenue
    const currentMonthRevenue = allCompleted
      .filter((b) => b.createdAt >= startOfMonth)
      .reduce((sum, b) => sum + Number(b.service.price), 0);
    const lastMonthRevenue = allCompleted
      .filter(
        (b) => b.createdAt >= startOfLastMonth && b.createdAt < startOfMonth,
      )
      .reduce((sum, b) => sum + Number(b.service.price), 0);

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

    const completedWithPrice = await this.fetchCompletedBookingsWithPrice({
      gte: start,
      lte: end,
    });
    const revenue = completedWithPrice.reduce(
      (sum, b) => sum + Number(b.service.price),
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
  // Panel: top doctors ranked by completed visit count
  async getTopDoctors(limit: number = 5) {
    const topRaw = await this.prisma.booking.groupBy({
      by: ['doctorId'],
      where: { status: BookingStatus.COMPLETED },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const ids = topRaw.map((d) => d.doctorId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, avatar: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const topDoctors = topRaw.map((d) => ({
      id: d.doctorId,
      fullName: userMap.get(d.doctorId)?.fullName ?? 'Unknown',
      avatar: userMap.get(d.doctorId)?.avatar ?? null,
      visitCount: d._count.id,
    }));

    return ResponseHelper.success(
      { topDoctors },
      'ADMIN.DASHBOARD.TOP_DOCTORS',
      'Top doctors retrieved successfully',
      200,
    );
  }

  // GET /admin/dashboard/revenue-chart?months=6
  // Chart: monthly revenue for the last N months
  async getRevenueChart(months: number = 6) {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const completedBookings = await this.fetchCompletedBookingsWithPrice({
      gte: since,
    });

    // Build map with all N months pre-filled at 0
    const revenueByMonth = new Map<string, number>();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.set(key, 0);
    }

    for (const b of completedBookings) {
      const key = `${b.createdAt.getFullYear()}-${String(b.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (revenueByMonth.has(key)) {
        revenueByMonth.set(
          key,
          revenueByMonth.get(key)! + Number(b.service.price),
        );
      }
    }

    const chart = Array.from(revenueByMonth.entries()).map(
      ([month, revenue]) => ({
        date: `${month}-01`,
        revenue,
      }),
    );

    return ResponseHelper.success(
      { months, chart },
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
}
