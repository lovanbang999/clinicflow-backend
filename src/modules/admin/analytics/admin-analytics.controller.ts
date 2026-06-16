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
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';

@ApiTags('admin - analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @ResponseMessage(
    MessageCodes.ANALYTICS_OVERVIEW_RETRIEVED,
    'Analytics overview retrieved successfully',
  )
  @ApiOperation({ summary: 'Analytics KPI overview (ADMIN only)' })
  @ApiResponse({ status: 200, type: AnalyticsOverviewResponseDto })
  getAnalyticsOverview(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getAnalyticsOverview(query);
  }

  @Get('top-doctors')
  @ResponseMessage(
    MessageCodes.ANALYTICS_TOP_DOCTORS_RETRIEVED,
    'Top doctors retrieved successfully',
  )
  @ApiOperation({ summary: 'Top doctors by revenue (ADMIN only)' })
  @ApiResponse({ status: 200, type: TopDoctorsResponseDto })
  getTopDoctors(@Query() query: { limit?: string } & DateRangeQueryDto) {
    const limit = query.limit ? parseInt(query.limit, 10) : 5;
    return this.analyticsService.getTopDoctors(limit, query);
  }

  @Get('top-services')
  @ResponseMessage(
    MessageCodes.ANALYTICS_TOP_SERVICES_RETRIEVED,
    'Top services retrieved successfully',
  )
  @ApiOperation({ summary: 'Top services by revenue (ADMIN only)' })
  @ApiResponse({ status: 200, type: TopServicesResponseDto })
  getTopServices(@Query() query: { limit?: string } & DateRangeQueryDto) {
    const limit = query.limit ? parseInt(query.limit, 10) : 5;
    return this.analyticsService.getTopServices(limit, query);
  }

  @Get('revenue-chart')
  @ResponseMessage(
    MessageCodes.ANALYTICS_REVENUE_CHART_RETRIEVED,
    'Revenue chart data retrieved successfully',
  )
  @ApiOperation({ summary: 'Revenue trend chart data (ADMIN only)' })
  @ApiResponse({ status: 200, type: RevenueChartResponseDto })
  getRevenueChart(@Query() query: GetRevenueChartQueryDto) {
    return this.analyticsService.getRevenueChart(query);
  }

  @Get('booking-overview')
  @ResponseMessage(
    MessageCodes.ANALYTICS_BOOKING_OVERVIEW_RETRIEVED,
    'Booking overview retrieved successfully',
  )
  @ApiOperation({ summary: 'Booking status breakdown (ADMIN only)' })
  @ApiResponse({ status: 200, type: BookingOverviewResponseDto })
  getBookingOverview(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getBookingOverview(query);
  }

  @Get('revenue-report')
  @ResponseMessage(
    MessageCodes.ANALYTICS_OVERVIEW_RETRIEVED,
    'Revenue report retrieved successfully',
  )
  @ApiOperation({ summary: 'Revenue report by period (ADMIN only)' })
  getRevenueReport(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getRevenueReport(query);
  }
}
