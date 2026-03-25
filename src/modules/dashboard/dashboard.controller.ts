import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get KPI stats for Dashboard (Appointments, Revenue, Patients)',
  })
  getStats() {
    return this.dashboardService.getAdminStats();
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Get Revenue Chart data (week/month/quarter)' })
  @ApiQuery({
    name: 'period',
    required: true,
    enum: ['week', 'month', 'quarter'],
  })
  getRevenueChart(@Query('period') period: 'week' | 'month' | 'quarter') {
    return this.dashboardService.getRevenueChart(period);
  }

  @Get('top-doctors')
  @ApiOperation({
    summary: 'Get Top 5 Doctors by completed appointments this month',
  })
  getTopDoctors() {
    return this.dashboardService.getTopDoctors();
  }

  @Get('top-services')
  @ApiOperation({ summary: 'Get Top 5 Services by usage this month' })
  getTopServices() {
    return this.dashboardService.getTopServices();
  }
}
