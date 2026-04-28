import { Injectable } from '@nestjs/common';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../../database/interfaces/booking.repository.interface';
import {
  IFinanceRepository,
  I_FINANCE_REPOSITORY,
} from '../../database/interfaces/finance.repository.interface';
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../../database/interfaces/profile.repository.interface';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../../database/interfaces/user.repository.interface';
import { Inject } from '@nestjs/common';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { UserRole, BookingStatus } from '@prisma/client';
import { DateRangeQueryDto } from '../analytics/dto/date-range.query.dto';

@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_FINANCE_REPOSITORY)
    private readonly financeRepository: IFinanceRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  private async fetchPaidInvoices(filter: { gte?: Date; lte?: Date }) {
    return this.financeRepository.findManyInvoice({
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

  async getDashboardOverview(query: DateRangeQueryDto) {
    const { from, to } = query;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const filterGte = from ? new Date(from) : undefined;
    const filterLte = to ? new Date(to) : undefined;

    const currentPeriodInvoices = await this.fetchPaidInvoices({
      gte: filterGte || startOfMonth,
      lte: filterLte,
    });

    const [
      totalPatients,
      totalDoctors,
      totalBookings,
      periodPatients,
      comparisonPatients,
    ] = await Promise.all([
      this.profileRepository.countPatientProfile({}),
      this.userRepository.count({
        where: { role: UserRole.DOCTOR, isActive: true },
      }),
      this.bookingRepository.countBooking({}),
      // New patient profiles in selected period OR this month
      this.profileRepository.countPatientProfile({
        where: {
          createdAt: {
            gte: filterGte || startOfMonth,
            lte: filterLte,
          },
        },
      }),
      // Comparison: if no filter, use last month
      !from
        ? this.profileRepository.countPatientProfile({
            where: {
              createdAt: { gte: startOfLastMonth, lt: startOfMonth },
            },
          })
        : Promise.resolve(0),
    ]);

    // Total Revenue (all time for KPI, unless we want it filtered?)
    // Usually "Total Revenue" KPI is all time, but "Revenue this period" is filtered.
    const allPaid = await this.fetchPaidInvoices({});
    const totalRevenue = allPaid.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    // Filtered revenue
    const periodRevenue = currentPeriodInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    // Period Bookings
    const periodBookings = await this.bookingRepository.countBooking({
      where: {
        createdAt: {
          gte: filterGte || startOfMonth,
          lte: filterLte,
        },
      },
    });

    // Trend calculation (only if no custom filter, otherwise trend might not make sense without same-duration comparison)
    let revenueGrowthPct = 0;
    let lastMonthRevenue = 0;
    let lastMonthBookings = 0;

    if (!from) {
      const [lmRev, lmBookings] = await Promise.all([
        Promise.resolve(
          allPaid
            .filter(
              (inv) =>
                inv.paidAt &&
                inv.paidAt >= startOfLastMonth &&
                inv.paidAt < startOfMonth,
            )
            .reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
        ),
        this.bookingRepository.countBooking({
          where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
        }),
      ]);

      lastMonthRevenue = lmRev;
      lastMonthBookings = lmBookings;

      revenueGrowthPct =
        lastMonthRevenue > 0
          ? Math.round(
              ((periodRevenue - lastMonthRevenue) / lastMonthRevenue) * 100,
            )
          : 0;
    }

    return ResponseHelper.success(
      {
        totalUsers: totalPatients,
        totalDoctors,
        totalBookings,
        totalRevenue,
        trends: {
          newPatientsThisMonth: periodPatients,
          newPatientsLastMonth: comparisonPatients,
          newBookingsThisMonth: periodBookings,
          newBookingsLastMonth: from ? 0 : lastMonthBookings,
          currentMonthRevenue: periodRevenue,
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
      this.bookingRepository.countBooking({
        where: { createdAt: { gte: start, lte: end } },
      }),
      this.bookingRepository.countBooking({
        where: {
          status: BookingStatus.COMPLETED,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.userRepository.count({
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
}
