import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Query DTOs
import { GetMonthlyStatsQueryDto } from './dto/get-monthly-stats.query.dto';
import { GetTopDoctorsQueryDto } from './dto/get-top-doctors.query.dto';
import { GetRevenueChartQueryDto } from './dto/get-revenue-chart.query.dto';

// Response DTOs (for Swagger @ApiResponse typing)
import { DashboardOverviewResponseDto } from './dto/dashboard-overview.response.dto';
import { MonthlyStatsResponseDto } from './dto/monthly-stats.response.dto';
import { TopDoctorsResponseDto } from './dto/top-doctors.response.dto';
import { RevenueChartResponseDto } from './dto/revenue-chart.response.dto';
import { BookingOverviewResponseDto } from './dto/booking-overview.response.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // KPI Overview — 4 top cards
  @Get('dashboard/overview')
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
    return this.adminService.getDashboardOverview();
  }

  // Monthly Stats — "This Month" panel
  @Get('dashboard/monthly-stats')
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
    return this.adminService.getMonthlyStats(query.month);
  }

  // Top Doctors — ranked by completed visits
  @Get('dashboard/top-doctors')
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
    return this.adminService.getTopDoctors(query.limit ?? 5);
  }

  // Revenue Chart — time series for ShadcnUI AreaChart
  @Get('dashboard/revenue-chart')
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
    return this.adminService.getRevenueChart(query.months ?? 6);
  }

  // Booking Overview — status breakdown with percentages
  @Get('dashboard/booking-overview')
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
    return this.adminService.getBookingOverview();
  }
}
