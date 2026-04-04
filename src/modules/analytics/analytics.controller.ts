import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // PATIENT

  @Get('patient/me/visit-trend')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Monthly visit trend for the last 12 months (patient)',
  })
  getPatientVisitTrend(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getPatientVisitTrend(req.user.id);
  }

  @Get('patient/me/top-diseases')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Top 5 most frequent diagnoses for this patient' })
  getPatientTopDiseases(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getPatientTopDiseases(req.user.id);
  }

  @Get('patient/me/total-spending')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Total medical spending (all time + this year)' })
  getPatientTotalSpending(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getPatientTotalSpending(req.user.id);
  }

  // DOCTOR

  @Get('doctor/me/top-diagnoses')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Top 5 diagnoses made by this doctor' })
  getDoctorTopDiagnoses(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorTopDiagnoses(req.user.id);
  }

  @Get('doctor/me/booking-status')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Breakdown of booking statuses (Completed / Cancelled / No-show)',
  })
  getDoctorBookingStatusBreakdown(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorBookingStatusBreakdown(req.user.id);
  }

  @Get('doctor/me/patients-per-month')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Number of patients seen per month in the last 6 months',
  })
  getDoctorPatientsPerMonth(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorPatientsPerMonth(req.user.id);
  }
}
