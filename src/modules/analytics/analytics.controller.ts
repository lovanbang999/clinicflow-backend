import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // PATIENT

  @Get('patient/me/visit-trend')
  @Roles(UserRole.PATIENT)
  @ResponseMessage(
    MessageCodes.ANALYTICS_VISIT_TREND_RETRIEVED,
    'Patient visit trend retrieved successfully',
  )
  @ApiOperation({
    summary: 'Monthly visit trend for the last 12 months (patient)',
  })
  getPatientVisitTrend(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getPatientVisitTrend(req.user.id);
  }

  @Get('patient/me/top-diseases')
  @Roles(UserRole.PATIENT)
  @ResponseMessage(
    MessageCodes.ANALYTICS_TOP_DISEASES_RETRIEVED,
    'Patient top diseases retrieved successfully',
  )
  @ApiOperation({ summary: 'Top 5 most frequent diagnoses for this patient' })
  getPatientTopDiseases(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getPatientTopDiseases(req.user.id);
  }

  @Get('patient/me/total-spending')
  @Roles(UserRole.PATIENT)
  @ResponseMessage(
    MessageCodes.ANALYTICS_SPENDING_RETRIEVED,
    'Patient spending retrieved successfully',
  )
  @ApiOperation({ summary: 'Total medical spending (all time + this year)' })
  getPatientTotalSpending(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getPatientTotalSpending(req.user.id);
  }

  // DOCTOR

  @Get('doctor/me/top-diagnoses')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_TOP_DIAGNOSES_RETRIEVED,
    'Doctor top diagnoses retrieved successfully',
  )
  @ApiOperation({ summary: 'Top 5 diagnoses made by this doctor' })
  getDoctorTopDiagnoses(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorTopDiagnoses(req.user.id);
  }

  @Get('doctor/me/booking-status')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_BOOKING_STATUS_RETRIEVED,
    'Doctor booking status breakdown retrieved successfully',
  )
  @ApiOperation({
    summary: 'Breakdown of booking statuses (Completed / Cancelled / No-show)',
  })
  getDoctorBookingStatusBreakdown(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorBookingStatusBreakdown(req.user.id);
  }

  @Get('doctor/me/patients-per-month')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_PATIENTS_PER_MONTH_RETRIEVED,
    'Doctor patients seen per month retrieved successfully',
  )
  @ApiOperation({
    summary: 'Number of patients seen per month in the last 6 months',
  })
  getDoctorPatientsPerMonth(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorPatientsPerMonth(req.user.id);
  }

  @Get('doctor/me/summary')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_SUMMARY_RETRIEVED,
    'Doctor summary stats retrieved successfully',
  )
  @ApiOperation({ summary: 'Summary stats with period filter for this doctor' })
  getDoctorSummary(
    @Req() req: { user: { id: string } },
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getDoctorSummary(req.user.id, period);
  }

  @Get('doctor/me/recent-patients')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_RECENT_PATIENTS_RETRIEVED,
    'Doctor recent patients list retrieved successfully',
  )
  @ApiOperation({ summary: 'Ten most recent patients seen by this doctor' })
  getDoctorRecentPatients(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorRecentPatients(req.user.id);
  }

  @Get('doctor/me/today-schedule')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_TODAY_SCHEDULE_RETRIEVED,
    "Doctor today's schedule timeline retrieved successfully",
  )
  @ApiOperation({ summary: "Today's appointment timeline for this doctor" })
  getDoctorTodaySchedule(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorTodaySchedule(req.user.id);
  }

  @Get('doctor/me/heatmap')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_HEATMAP_RETRIEVED,
    'Doctor booking heatmap retrieved successfully',
  )
  @ApiOperation({
    summary: 'Booking count heatmap (hour × day-of-week) for last 12 weeks',
  })
  getDoctorHeatmap(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorHeatmap(req.user.id);
  }

  @Get('doctor/me/clinical-kpis')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_CLINICAL_KPIS_RETRIEVED,
    'Doctor clinical KPIs retrieved successfully',
  )
  @ApiOperation({
    summary: 'Real clinical KPIs for this doctor (last 6 months)',
  })
  getDoctorClinicalKPIs(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorClinicalKPIs(req.user.id);
  }

  @Get('doctor/me/top-services')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_TOP_SERVICES_RETRIEVED,
    'Doctor top services retrieved successfully',
  )
  @ApiOperation({ summary: 'Top 5 services performed by this doctor' })
  getDoctorTopServices(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorTopServices(req.user.id);
  }

  @Get('doctor/me/weekly-bookings')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.ANALYTICS_DOCTOR_WEEKLY_BOOKINGS_RETRIEVED,
    'Doctor weekly bookings trend retrieved successfully',
  )
  @ApiOperation({ summary: 'Daily booking count in the current week for this doctor' })
  getDoctorWeeklyBookings(@Req() req: { user: { id: string } }) {
    return this.analyticsService.getDoctorWeeklyBookings(req.user.id);
  }
}
