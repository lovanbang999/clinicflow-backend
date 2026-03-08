import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, Prisma, UserRole } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { FilterDoctorDto } from './dto/filter-doctor.dto';
import { AdminUpdateDoctorProfileDto } from './dto/admin-update-doctor-profile.dto';
import { AdminSuspendUserDto } from './dto/admin-suspend-user.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // Shared helper: revenue via service.price JOIN
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

  // GET /admin/dashboard/overview
  // KPI cards: totalUsers, totalDoctors, totalBookings, totalRevenue
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
      this.prisma.user.count({
        where: { role: UserRole.PATIENT, isActive: true },
      }),
      this.prisma.user.count({
        where: { role: UserRole.DOCTOR, isActive: true },
      }),
      this.prisma.booking.count(),
      // New patients this month
      this.prisma.user.count({
        where: {
          role: UserRole.PATIENT,
          createdAt: { gte: startOfMonth },
        },
      }),
      // New patients last month (for trend)
      this.prisma.user.count({
        where: {
          role: UserRole.PATIENT,
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

  // ============================================================
  // DOCTOR MANAGEMENT
  // ============================================================

  /**
   * GET /admin/doctors/statistics
   * Stat cards: totalDoctors, activeDoctors, inactiveDoctors,
   *             onLeaveDoctors (placeholder), newThisMonth, bySpecialty
   */
  async getDoctorStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalDoctors, activeDoctors, newThisMonth, profilesWithSpecialties] =
      await Promise.all([
        this.prisma.user.count({ where: { role: UserRole.DOCTOR } }),
        this.prisma.user.count({
          where: { role: UserRole.DOCTOR, isActive: true },
        }),
        this.prisma.user.count({
          where: {
            role: UserRole.DOCTOR,
            createdAt: { gte: startOfMonth },
          },
        }),
        this.prisma.doctorProfile.findMany({
          select: { specialties: true },
          where: { user: { isActive: true } },
        }),
      ]);

    // Aggregate specialty counts
    const bySpecialty: Record<string, number> = {};
    for (const p of profilesWithSpecialties) {
      for (const sp of p.specialties) {
        bySpecialty[sp] = (bySpecialty[sp] ?? 0) + 1;
      }
    }

    return ResponseHelper.success(
      {
        totalDoctors,
        activeDoctors,
        inactiveDoctors: totalDoctors - activeDoctors,
        // "On Leave" is not a DB concept yet; expose 0 until a leave-management
        // feature is added. The frontend stat card may be hidden or hard-coded.
        onLeaveDoctors: 0,
        newThisMonth,
        bySpecialty,
      },
      'ADMIN.DOCTORS.STATISTICS',
      'Doctor statistics retrieved successfully',
      200,
    );
  }

  /**
   * GET /admin/doctors
   * Paginated list with optional specialty / isActive / search filters.
   */
  async findAllDoctors(filterDto: FilterDoctorDto) {
    const { specialty, isActive, search, page = 1, limit = 10 } = filterDto;

    const where: Prisma.UserWhereInput = {
      role: UserRole.DOCTOR,
    };

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (specialty) {
      where.doctorProfile = {
        specialties: { hasSome: [specialty] },
      };
    }

    const [doctors, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              id: true,
              specialties: true,
              qualifications: true,
              yearsOfExperience: true,
              bio: true,
              rating: true,
              reviewCount: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        doctors,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      'ADMIN.DOCTORS.LIST',
      'Doctors retrieved successfully',
      200,
    );
  }

  /**
   * GET /admin/doctors/:id
   * Full detail of a single doctor including bookings stats.
   */
  async findOneDoctor(id: string) {
    const doctor = await this.prisma.user.findFirst({
      where: { id, role: UserRole.DOCTOR },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        gender: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            id: true,
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            rating: true,
            reviewCount: true,
          },
        },
        _count: {
          select: {
            bookingsAsDoctor: {
              where: { status: BookingStatus.COMPLETED },
            },
          },
        },
      },
    });

    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Doctor retrieval failed',
      );
    }

    return ResponseHelper.success(
      doctor,
      'ADMIN.DOCTORS.DETAIL',
      'Doctor retrieved successfully',
      200,
    );
  }

  /**
   * PATCH /admin/doctors/:id/profile
   * Update fields on the DoctorProfile table only.
   * If no profile exists yet, it is created (upsert).
   */
  async updateDoctorProfile(id: string, dto: AdminUpdateDoctorProfileDto) {
    // Verify the user exists and is a DOCTOR
    const user = await this.prisma.user.findFirst({
      where: { id, role: UserRole.DOCTOR },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Profile update failed',
      );
    }

    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        specialties: dto.specialties ?? [],
        qualifications: dto.qualifications ?? [],
        yearsOfExperience: dto.yearsOfExperience ?? 0,
        bio: dto.bio ?? null,
        rating: dto.rating ?? 0,
      },
      update: {
        ...(dto.specialties !== undefined && { specialties: dto.specialties }),
        ...(dto.qualifications !== undefined && {
          qualifications: dto.qualifications,
        }),
        ...(dto.yearsOfExperience !== undefined && {
          yearsOfExperience: dto.yearsOfExperience,
        }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
      },
      select: {
        id: true,
        userId: true,
        specialties: true,
        qualifications: true,
        yearsOfExperience: true,
        bio: true,
        rating: true,
        reviewCount: true,
        updatedAt: true,
      },
    });

    return ResponseHelper.success(
      profile,
      'ADMIN.DOCTORS.PROFILE_UPDATED',
      'Doctor profile updated successfully',
      200,
    );
  }

  /**
   * PATCH /admin/doctors/:id/status
   * Suspend (isActive=false) or reinstate (isActive=true) a doctor account.
   */
  async toggleDoctorActive(id: string, dto: AdminSuspendUserDto) {
    const doctor = await this.prisma.user.findFirst({
      where: { id, role: UserRole.DOCTOR },
    });

    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Status update failed',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return ResponseHelper.success(
      updated,
      'ADMIN.DOCTORS.STATUS_UPDATED',
      `Doctor ${dto.isActive ? 'reinstated' : 'suspended'} successfully`,
      200,
    );
  }
}
