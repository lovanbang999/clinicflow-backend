import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardOverviewResponseDto } from './dto/dashboard-overview.response.dto';
import { MonthlyStatsResponseDto } from './dto/monthly-stats.response.dto';
import { GetMonthlyStatsQueryDto } from './dto/get-monthly-stats.query.dto';
import { TopDoctorsResponseDto } from './dto/top-doctors.response.dto';
import { GetTopDoctorsQueryDto } from './dto/get-top-doctors.query.dto';
import { RevenueChartResponseDto } from './dto/revenue-chart.response.dto';
import { GetRevenueChartQueryDto } from './dto/get-revenue-chart.query.dto';
import { BookingOverviewResponseDto } from './dto/booking-overview.response.dto';
import { TopServicesResponseDto } from './dto/top-services.response.dto';
import { GetTopServicesQueryDto } from './dto/get-top-services.query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('admin - dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /**
   * GET /admin/dashboard/overview
   * KPI overview.
   */
  @Get('overview')
  @ApiOperation({
    summary: 'KPI overview (ADMIN only)',
    description:
      'Returns the 4 key metrics: totalUsers (patients), totalDoctors, ' +
      'totalBookings, totalRevenue. Also includes month-on-month trend values ' +
      'used by the KPI badges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview retrieved successfully',
    type: DashboardOverviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getDashboardOverview() {
    return this.dashboardService.getDashboardOverview();
  }

  /**
   * GET /admin/dashboard/monthly-stats
   * Monthly statistics.
   */
  @Get('monthly-stats')
  @ApiOperation({
    summary: 'Monthly statistics (ADMIN only)',
    description:
      'Returns stats for a given month: bookingCount, newPatients, ' +
      'successRate, revenue. Defaults to current month if no query param provided.',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly stats retrieved successfully',
    type: MonthlyStatsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid month format' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getMonthlyStats(@Query() query: GetMonthlyStatsQueryDto) {
    return this.dashboardService.getMonthlyStats(query.month);
  }

  /**
   * GET /admin/dashboard/top-doctors
   * Top doctors by completed visits.
   */
  @Get('top-doctors')
  @ApiOperation({
    summary: 'Top doctors by completed visits (ADMIN only)',
    description:
      'Returns doctors ranked by completed booking count. Configurable via limit (max 20).',
  })
  @ApiResponse({
    status: 200,
    description: 'Top doctors retrieved successfully',
    type: TopDoctorsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getTopDoctors(@Query() query: GetTopDoctorsQueryDto) {
    return this.dashboardService.getTopDoctors(query.limit ?? 5);
  }

  /**
   * GET /admin/dashboard/revenue-chart
   * Monthly revenue chart data.
   */
  @Get('revenue-chart')
  @ApiOperation({
    summary: 'Monthly revenue chart data (ADMIN only)',
    description:
      'Returns revenue aggregated by month for the last N months. ' +
      'Each point: { date: "YYYY-MM-01", revenue: number }. Max 24 months.',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue chart data retrieved successfully',
    type: RevenueChartResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getRevenueChart(@Query() query: GetRevenueChartQueryDto) {
    return this.dashboardService.getRevenueChart(query);
  }

  /**
   * GET /admin/dashboard/booking-overview
   * Booking status overview.
   */
  @Get('booking-overview')
  @ApiOperation({
    summary: 'Booking status overview (ADMIN only)',
    description:
      'Returns booking counts broken down by status (completed, upcoming, ' +
      'cancelled, inProgress) with percentage values ready for the stacked bar chart.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking overview retrieved successfully',
    type: BookingOverviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getBookingOverview() {
    return this.dashboardService.getBookingOverview();
  }

  /**
   * GET /admin/dashboard/top-services
   * Top services by usage.
   */
  @Get('top-services')
  @ApiOperation({
    summary: 'Top services by usage this month (ADMIN only)',
    description:
      'Returns services ranked by booking count for the current month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Top services retrieved successfully',
    type: TopServicesResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getTopServices(@Query() query: GetTopServicesQueryDto) {
    return this.dashboardService.getTopServices(query.limit ?? 5);
  }
}
