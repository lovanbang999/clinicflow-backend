import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DateRangeQueryDto } from './dto/date-range.query.dto';
import { GetRevenueChartQueryDto } from './dto/get-revenue-chart.query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AnalyticsOverviewResponseDto } from './dto/analytics-overview.response.dto';
import { TopDoctorsResponseDto } from './dto/top-doctors.response.dto';
import { TopServicesResponseDto } from './dto/top-services.response.dto';
import { RevenueChartResponseDto } from './dto/revenue-chart.response.dto';
import { BookingOverviewResponseDto } from './dto/booking-overview.response.dto';

@ApiTags('admin - analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Analytics KPI overview (ADMIN only)' })
  @ApiResponse({ status: 200, type: AnalyticsOverviewResponseDto })
  getAnalyticsOverview(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getAnalyticsOverview(query);
  }

  @Get('top-doctors')
  @ApiOperation({ summary: 'Top doctors by revenue (ADMIN only)' })
  @ApiResponse({ status: 200, type: TopDoctorsResponseDto })
  getTopDoctors(@Query() query: { limit?: number } & DateRangeQueryDto) {
    return this.analyticsService.getTopDoctors(query.limit ?? 5, query);
  }

  @Get('top-services')
  @ApiOperation({ summary: 'Top services by revenue (ADMIN only)' })
  @ApiResponse({ status: 200, type: TopServicesResponseDto })
  getTopServices(@Query() query: { limit?: number } & DateRangeQueryDto) {
    return this.analyticsService.getTopServices(query.limit ?? 5, query);
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Revenue trend chart data (ADMIN only)' })
  @ApiResponse({ status: 200, type: RevenueChartResponseDto })
  getRevenueChart(@Query() query: GetRevenueChartQueryDto) {
    return this.analyticsService.getRevenueChart(query);
  }

  @Get('booking-overview')
  @ApiOperation({ summary: 'Booking status breakdown (ADMIN only)' })
  @ApiResponse({ status: 200, type: BookingOverviewResponseDto })
  getBookingOverview(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getBookingOverview(query);
  }
}
