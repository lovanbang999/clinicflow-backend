import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { UserRole, BookingStatus } from '@prisma/client';
import { DateRangeQueryDto } from './dto/date-range.query.dto';
import { GetRevenueChartQueryDto } from './dto/get-revenue-chart.query.dto';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from 'src/modules/database/interfaces/booking.repository.interface';
import {
  I_FINANCE_REPOSITORY,
  IFinanceRepository,
} from 'src/modules/database/interfaces/finance.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from 'src/modules/database/interfaces/profile.repository.interface';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from 'src/modules/database/interfaces/user.repository.interface';

@Injectable()
export class AdminAnalyticsService {
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

  async getAnalyticsOverview(query: DateRangeQueryDto) {
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
      this.profileRepository.countPatientProfile({
        where: {
          createdAt: {
            gte: filterGte || startOfMonth,
            lte: filterLte,
          },
        },
      }),
      !from
        ? this.profileRepository.countPatientProfile({
            where: {
              createdAt: { gte: startOfLastMonth, lt: startOfMonth },
            },
          })
        : Promise.resolve(0),
    ]);

    const allPaid = await this.fetchPaidInvoices({});
    const totalRevenue = allPaid.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const periodRevenue = currentPeriodInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const periodBookings = await this.bookingRepository.countBooking({
      where: {
        createdAt: {
          gte: filterGte || startOfMonth,
          lte: filterLte,
        },
      },
    });

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
      'ADMIN.ANALYTICS.OVERVIEW',
      'Analytics overview retrieved successfully',
      200,
    );
  }

  async getTopDoctors(limit: number = 5, dateRange?: DateRangeQueryDto) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filterGte = dateRange?.from ? new Date(dateRange.from) : startOfMonth;
    const filterLte = dateRange?.to ? new Date(dateRange.to) : undefined;

    type InvoiceGroupByRow = {
      bookingId?: string | null;
      _sum?: { totalAmount?: number | null };
    };
    const topRaw = (await this.financeRepository.groupByInvoice({
      by: ['bookingId'],
      where: {
        status: 'PAID',
        paidAt: { gte: filterGte, lte: filterLte },
      },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit * 2,
    })) as InvoiceGroupByRow[];

    const bookingIds = topRaw
      .map((r) => r.bookingId)
      .filter((id): id is string => Boolean(id));
    const doctorRevenueMap = new Map<string, number>();
    const doctorCountMap = new Map<string, number>();
    const doctorInfoMap = new Map<
      string,
      { fullName: string; avatar: string | null; specialties: string[] }
    >();

    const bookingsWithProfiles = await this.bookingRepository.findManyBooking({
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
          (doctorRevenueMap.get(dId) || 0) + Number(row._sum?.totalAmount ?? 0),
        );
        doctorCountMap.set(dId, (doctorCountMap.get(dId) || 0) + 1);

        if (!doctorInfoMap.has(dId)) {
          doctorInfoMap.set(dId, {
            fullName: booking.doctor.fullName,
            avatar: booking.doctor.avatar,
            specialties:
              (booking.doctor.doctorProfile?.specialties as string[]) || [],
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
      'ADMIN.ANALYTICS.TOP_DOCTORS',
      'Top doctors retrieved successfully',
      200,
    );
  }

  async getRevenueChart(query: GetRevenueChartQueryDto) {
    const { from, to, months = 6, period = 'month' } = query;
    const now = new Date();
    let since: Date;
    let until: Date = now;
    let isDaily = false;
    let points = 6;

    if (from) {
      since = new Date(from);
      if (to) until = new Date(to);
      const diffDays = Math.ceil(
        (until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24),
      );
      isDaily = diffDays <= 60;
      points = isDaily
        ? diffDays + 1
        : Math.ceil(diffDays / 30) + (until.getMonth() - since.getMonth());
    } else if (period === 'week') {
      since = new Date(now);
      since.setDate(now.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      isDaily = true;
      points = 7;
    } else if (period === 'month') {
      since = new Date(now);
      since.setDate(now.getDate() - 29);
      since.setHours(0, 0, 0, 0);
      isDaily = true;
      points = 30;
    } else if (period === 'quarter') {
      since = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      since.setHours(0, 0, 0, 0);
      isDaily = false;
      points = 3;
    } else {
      since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      since.setHours(0, 0, 0, 0);
      isDaily = false;
      points = months;
    }

    const paidInvoices = await this.fetchPaidInvoices({
      gte: since,
      lte: until,
    });

    const revenueByPoint = new Map<string, number>();

    if (isDaily) {
      for (let i = 0; i < points; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        if (d > until) break;
        const key = d.toISOString().split('T')[0];
        revenueByPoint.set(key, 0);
      }
    } else {
      for (let i = 0; i < points; i++) {
        const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
        if (d > until && i > 0) break;
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
      'ADMIN.ANALYTICS.REVENUE_CHART',
      'Revenue chart data retrieved successfully',
      200,
    );
  }

  async getBookingOverview(query?: DateRangeQueryDto) {
    const now = new Date();
    const filterGte = query?.from ? new Date(query.from) : undefined;
    const filterLte = query?.to ? new Date(query.to) : undefined;

    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (filterGte || filterLte) {
      where.createdAt = { gte: filterGte, lte: filterLte };
    }

    const [total, completed, upcoming, cancelled, inProgress] =
      await Promise.all([
        this.bookingRepository.countBooking({ where }),
        this.bookingRepository.countBooking({
          where: { ...where, status: BookingStatus.COMPLETED },
        }),
        this.bookingRepository.countBooking({
          where: {
            ...where,
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            bookingDate: { gte: now },
          },
        }),
        this.bookingRepository.countBooking({
          where: { ...where, status: BookingStatus.CANCELLED },
        }),
        this.bookingRepository.countBooking({
          where: {
            ...where,
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
      'ADMIN.ANALYTICS.BOOKING_OVERVIEW',
      'Booking overview retrieved successfully',
      200,
    );
  }

  async getTopServices(limit: number = 5, query?: DateRangeQueryDto) {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filterGte = query?.from ? new Date(query.from) : startOfThisMonth;
    const filterLte = query?.to ? new Date(query.to) : undefined;

    const topInvoices = await this.financeRepository.findManyInvoice({
      where: {
        status: 'PAID',
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
      'ADMIN.ANALYTICS.TOP_SERVICES',
      'Top services retrieved successfully',
      200,
    );
  }
}
