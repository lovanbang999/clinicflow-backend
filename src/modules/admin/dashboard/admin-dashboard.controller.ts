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
import { DateRangeQueryDto } from '../analytics/dto/date-range.query.dto';
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
  getDashboardOverview(@Query() query: DateRangeQueryDto) {
    return this.dashboardService.getDashboardOverview(query);
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
}
