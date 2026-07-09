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

  async getDashboardOverview(query: DateRangeQueryDto) {
    const { from, to } = query;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const filterGte = from ? new Date(from) : undefined;
    const filterLte = to ? new Date(to) : undefined;
    const periodGte = filterGte || startOfMonth;

    const [
      totalPatients,
      totalDoctors,
      totalBookings,
      periodPatients,
      comparisonPatients,
      currentPeriodInvoices,
      allPaid,
    ] = await Promise.all([
      this.profileRepository.countTotalPatients(),
      this.userRepository.countActiveDoctors(),
      this.bookingRepository.countTotalBookings(),
      this.profileRepository.countPatientsByDateRange(periodGte, filterLte),
      !from
        ? this.profileRepository.countPatientsByDateRange(
            startOfLastMonth,
            new Date(startOfMonth.getTime() - 1),
          )
        : Promise.resolve(0),
      this.financeRepository.findPaidInvoicesForAnalytics({
        gte: periodGte,
        lte: filterLte,
      }),
      this.financeRepository.findPaidInvoicesForAnalytics({}),
    ]);

    const totalRevenue = allPaid.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const periodRevenue = currentPeriodInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const periodBookings =
      await this.bookingRepository.countBookingsByDateRange(
        periodGte,
        filterLte,
      );

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
        this.bookingRepository.countBookingsByDateRange(
          startOfLastMonth,
          new Date(startOfMonth.getTime() - 1),
        ),
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

    return {
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
    };
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

    const [bookingCount, completedCount, newPatients, paidInvoices] =
      await Promise.all([
        this.bookingRepository.countBookingsByDateRange(start, end),
        this.bookingRepository.countBookingsByStatusAndDateRange(
          BookingStatus.COMPLETED,
          start,
          end,
        ),
        this.userRepository.countUsersByRoleAndDateRange(
          UserRole.PATIENT,
          start,
          end,
        ),
        this.financeRepository.findPaidInvoicesForAnalytics({
          gte: start,
          lte: end,
        }),
      ]);

    const revenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const successRate =
      bookingCount > 0 ? Math.round((completedCount / bookingCount) * 100) : 0;

    return {
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      bookingCount,
      newPatients,
      successRate,
      revenue,
    };
  }
}
