import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('doctor/me/summary')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Summary stats with period filter for this doctor' })
  getDoctorSummary(
    @Req() req: { user: { id: string } },
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getDoctorSummary(req.user.id, period);
  }

  @Get('doctor/me/recent-patients')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Ten most recent patients seen by this doctor' })
  getDoctorRecentPatients(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorRecentPatients(req.user.id);
  }

  @Get('doctor/me/today-schedule')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: "Today's appointment timeline for this doctor" })
  getDoctorTodaySchedule(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorTodaySchedule(req.user.id);
  }

  @Get('doctor/me/heatmap')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Booking count heatmap (hour × day-of-week) for last 12 weeks',
  })
  getDoctorHeatmap(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorHeatmap(req.user.id);
  }

  @Get('doctor/me/clinical-kpis')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Real clinical KPIs for this doctor (last 6 months)',
  })
  getDoctorClinicalKPIs(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorClinicalKPIs(req.user.id);
  }
}
