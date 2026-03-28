import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ReceptionistAnalyticsService } from './receptionist-analytics.service';
import { DateRangeQueryDto } from '../../admin/analytics/dto/date-range.query.dto';

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
  @ApiOperation({ summary: 'Get receptionist dashboard overview' })
  getOverview(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Get revenue trend data' })
  getRevenueTrend(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getRevenueTrend(query);
  }

  @Get('operational')
  @ApiOperation({ summary: 'Get operational and throughput stats' })
  getOperationalStats(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getOperationalStats(query);
  }
}
