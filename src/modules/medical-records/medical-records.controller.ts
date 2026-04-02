import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { OrderServicesDto } from './dto/order-services.dto';
import { SaveDiagnosisDto } from './dto/save-diagnosis.dto';
import { SaveSymptomsDto } from './dto/save-symptoms.dto';
import { MedicalRecordsService } from './medical-records.service';

@ApiTags('Medical Records')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  // LEGACY — kept for backward compatibili
  @Post()
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: '[Legacy] Upsert Medical Record' })
  @ApiResponse({ status: 200 })
  upsertMedicalRecord(
    @Body() dto: CreateMedicalRecordDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.upsertMedicalRecord(dto, req.user.id);
  }

  // Symptoms
  @Patch(':bookingId/symptoms')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Save symptoms and clinical findings' })
  saveSymptoms(
    @Param('bookingId') bookingId: string,
    @Body() dto: SaveSymptomsDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.saveSymptoms(bookingId, dto, req.user.id);
  }

  // Service Orders
  @Post(':bookingId/service-orders')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Order services/procedures for this visit' })
  orderServices(
    @Param('bookingId') bookingId: string,
    @Body() dto: OrderServicesDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.orderServices(
      bookingId,
      dto,
      req.user.id,
    );
  }

  @Delete(':bookingId/service-orders/:orderId')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Remove a service order (only if PENDING)' })
  removeServiceOrder(
    @Param('bookingId') bookingId: string,
    @Param('orderId') orderId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.removeServiceOrder(
      bookingId,
      orderId,
      req.user.id,
    );
  }

  // Results + Diagnosis
  @Get(':bookingId/results')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'B4: Get visit results (service orders + existing diagnosis)',
  })
  getVisitResults(@Param('bookingId') bookingId: string) {
    return this.medicalRecordsService.getVisitResults(bookingId);
  }

  @Patch(':bookingId/diagnose')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Save ICD-10 diagnosis and treatment plan' })
  saveDiagnosis(
    @Param('bookingId') bookingId: string,
    @Body() dto: SaveDiagnosisDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.saveDiagnosis(
      bookingId,
      dto,
      req.user.id,
    );
  }

  // Prescription
  @Post(':bookingId/prescriptions')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Create/replace prescription (finalizes the visit)',
  })
  savePrescription(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreatePrescriptionDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.savePrescription(
      bookingId,
      dto,
      req.user.id,
    );
  }

  // ICD-10 Search
  @Get('icd10')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search ICD-10 codes for autocomplete' })
  searchICD10(@Query('q') q: string) {
    return this.medicalRecordsService.searchICD10(q || '');
  }

  // Patient History
  @Get('patient/:patientProfileId/history')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get patient visit history with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPatientHistory(
    @Param('patientProfileId') patientProfileId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.medicalRecordsService.getPatientHistory(
      patientProfileId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  // Patient self-service visits
  @Get('patient/my-visits')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Patient views their own visit history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMyVisits(
    @Req() req: { user: { id: string } },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.medicalRecordsService.getMyVisits(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  // Patient visit stats
  @Get('patient/my-stats')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Patient visit stats for their dashboard' })
  getPatientStats(@Req() req: { user: { id: string } }) {
    return this.medicalRecordsService.getPatientStats(req.user.id);
  }

  // Doctor stats
  @Get('doctor/stats')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Doctor stats for their dashboard panel' })
  getDoctorStats(@Req() req: { user: { id: string } }) {
    return this.medicalRecordsService.getDoctorStats(req.user.id);
  }
}
