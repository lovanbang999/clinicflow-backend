import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ReceptionistAnalyticsService } from './receptionist-analytics.service';
import { DateRangeQueryDto } from '../../admin/analytics/dto/date-range.query.dto';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { MessageCodes } from '../../../common/constants/message-codes.const';

@ApiTags('Receptionist Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
@Controller('receptionist/analytics')
export class ReceptionistAnalyticsController {
  constructor(
    private readonly analyticsService: ReceptionistAnalyticsService,
  ) {}

  @Get('overview')
  @ResponseMessage(
    MessageCodes.RECEPTIONIST_ANALYTICS_OVERVIEW,
    'Receptionist overview stats retrieved successfully',
  )
  @ApiOperation({ summary: 'Get receptionist dashboard overview' })
  getOverview(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('revenue-trend')
  @ResponseMessage(
    MessageCodes.RECEPTIONIST_ANALYTICS_REVENUE_TREND,
    'Revenue trend retrieved successfully',
  )
  @ApiOperation({ summary: 'Get revenue trend data' })
  getRevenueTrend(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getRevenueTrend(query);
  }

  @Get('operational')
  @ResponseMessage(
    MessageCodes.RECEPTIONIST_ANALYTICS_OPERATIONAL,
    'Operational stats retrieved successfully',
  )
  @ApiOperation({ summary: 'Get operational and throughput stats' })
  getOperationalStats(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getOperationalStats(query);
  }
}
