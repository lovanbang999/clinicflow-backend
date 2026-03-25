import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  subMonths,
  format,
} from 'date-fns';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats() {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    const yesterday = subDays(today, 1);
    const startOfYesterday = startOfDay(yesterday);
    const endOfYesterday = endOfDay(yesterday);

    const startOfThisMonth = startOfMonth(today);
    const startOfLastMonth = startOfMonth(subMonths(today, 1));

    // 1. Appointments Today
    const appointmentsToday = await this.prisma.booking.count({
      where: {
        bookingDate: { gte: startOfToday, lte: endOfToday },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    const appointmentsYesterday = await this.prisma.booking.count({
      where: {
        bookingDate: { gte: startOfYesterday, lte: endOfYesterday },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    // 2. Revenue Today (Total amount from PAID invoices)
    const revenueTodayAggr = await this.prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
    });
    const revenueToday = revenueTodayAggr._sum.totalAmount?.toNumber() || 0;

    const revenueYesterdayAggr = await this.prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startOfYesterday, lte: endOfYesterday },
      },
    });
    const revenueYesterday =
      revenueYesterdayAggr._sum.totalAmount?.toNumber() || 0;

    // 3. New Patients This Month
    const newPatientsThisMonth = await this.prisma.patientProfile.count({
      where: { createdAt: { gte: startOfThisMonth } },
    });

    const newPatientsLastMonth = await this.prisma.patientProfile.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
    });

    // 4. Calculate Trends
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return ResponseHelper.success(
      {
        appointments: {
          value: appointmentsToday,
          trend: calcTrend(appointmentsToday, appointmentsYesterday),
        },
        revenue: {
          value: revenueToday,
          trend: calcTrend(revenueToday, revenueYesterday),
        },
        newPatients: {
          value: newPatientsThisMonth,
          trend: calcTrend(newPatientsThisMonth, newPatientsLastMonth),
        },
      },
      'DASHBOARD.STATS_SUCCESS',
      'Dashboard stats retrieved successfully',
      200,
    );
  }

  async getRevenueChart(period: 'week' | 'month' | 'quarter') {
    const today = new Date();
    let startDate: Date;
    let days: number;

    if (period === 'week') {
      startDate = subDays(today, 6); // Last 7 days
      days = 7;
    } else if (period === 'month') {
      startDate = subDays(today, 29); // Last 30 days
      days = 30;
    } else {
      startDate = subDays(today, 89); // Last 90 days
      days = 90;
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: startOfDay(startDate) },
      },
      select: { totalAmount: true, createdAt: true },
    });

    // Aggregate by date (YYYY-MM-DD)
    const chartDataMap = new Map<string, number>();

    // Initialize map with all days in range to ensure 0s are present
    for (let i = 0; i < days; i++) {
      const d = startOfDay(subDays(today, days - 1 - i));
      chartDataMap.set(format(d, 'yyyy-MM-dd'), 0);
    }

    invoices.forEach((inv) => {
      const dateStr = format(inv.createdAt, 'yyyy-MM-dd');
      if (chartDataMap.has(dateStr)) {
        chartDataMap.set(
          dateStr,
          chartDataMap.get(dateStr)! + (inv.totalAmount?.toNumber() || 0),
        );
      }
    });

    const chartData = Array.from(chartDataMap.entries()).map(
      ([date, revenue]) => ({
        date,
        revenue,
      }),
    );

    return ResponseHelper.success(
      chartData,
      'DASHBOARD.CHART_SUCCESS',
      'Revenue chart retrieved successfully',
      200,
    );
  }

  async getTopDoctors() {
    const startOfThisMonth = startOfMonth(new Date());

    const bookings = await this.prisma.booking.groupBy({
      by: ['doctorId'],
      _count: { id: true },
      where: {
        bookingDate: { gte: startOfThisMonth },
        status: 'COMPLETED',
      },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    if (bookings.length === 0)
      return ResponseHelper.success([], 'DASHBOARD.TOP_DOCTORS', '', 200);

    const docIds = bookings.map((b) => b.doctorId);
    const doctors = await this.prisma.user.findMany({
      where: { id: { in: docIds } },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        doctorProfile: { select: { specialties: true } },
      },
    });

    const result = bookings.map((b) => {
      const doc = doctors.find((d) => d.id === b.doctorId);
      const specialties = doc?.doctorProfile?.specialties || [];
      return {
        id: b.doctorId,
        name: doc?.fullName || 'Unknown',
        specialty: specialties.length > 0 ? specialties[0] : 'Chuyên gia',
        avatar: doc?.avatar,
        patientsCount: b._count.id,
      };
    });

    return ResponseHelper.success(result, 'DASHBOARD.TOP_DOCTORS', '', 200);
  }

  async getTopServices() {
    const startOfThisMonth = startOfMonth(new Date());

    const bookings = await this.prisma.booking.groupBy({
      by: ['serviceId'],
      _count: { id: true },
      where: {
        bookingDate: { gte: startOfThisMonth },
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'PENDING'] },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    if (bookings.length === 0)
      return ResponseHelper.success([], 'DASHBOARD.TOP_SERVICES', '', 200);

    const serviceIds = bookings.map((b) => b.serviceId).filter(Boolean);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, price: true },
    });

    const result = bookings.map((b) => {
      const svc = services.find((s) => s.id === b.serviceId);
      return {
        id: b.serviceId,
        name: svc?.name || 'Unknown',
        bookingsCount: b._count.id,
        estimatedRevenue: (svc?.price?.toNumber() || 0) * b._count.id,
      };
    });

    return ResponseHelper.success(result, 'DASHBOARD.TOP_SERVICES', '', 200);
  }
}
