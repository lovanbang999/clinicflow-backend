import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole, User } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { OrderServicesDto } from './dto/order-services.dto';
import { SaveDiagnosisDto } from './dto/save-diagnosis.dto';
import { SaveSymptomsDto } from './dto/save-symptoms.dto';
import { CompleteSpecialistExamDto } from './dto/complete-specialist-exam.dto';
import { MedicalRecordsService } from './medical-records.service';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { MessageCodes } from '../../common/constants/message-codes.const';

@ApiTags('Medical Records')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  // LEGACY — kept for backward compatibility
  @Post()
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.MEDICAL_RECORD_UPSERTED,
    'Medical record saved successfully',
  )
  @ApiOperation({ summary: '[Legacy] Upsert Medical Record' })
  @ApiResponse({ status: 200 })
  upsertMedicalRecord(
    @Body() dto: CreateMedicalRecordDto,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.upsertMedicalRecord(dto, user.id, user);
  }

  // Symptoms
  @Patch(':bookingId/symptoms')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.MEDICAL_RECORD_SYMPTOMS_SAVED,
    'Symptoms and clinical findings saved successfully',
  )
  @ApiOperation({ summary: 'Save symptoms and clinical findings' })
  saveSymptoms(
    @Param('bookingId') bookingId: string,
    @Body() dto: SaveSymptomsDto,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.saveSymptoms(
      bookingId,
      dto,
      user.id,
      user,
    );
  }

  // Service Orders
  @Post(':bookingId/service-orders')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.MEDICAL_RECORD_SERVICES_ORDERED,
    'Services ordered successfully',
  )
  @ApiOperation({ summary: 'Order services/procedures for this visit' })
  orderServices(
    @Param('bookingId') bookingId: string,
    @Body() dto: OrderServicesDto,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.orderServices(
      bookingId,
      dto,
      user.id,
      user,
    );
  }

  @Delete(':bookingId/service-orders/:orderId')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.MEDICAL_RECORD_SERVICE_ORDER_REMOVED,
    'Service order removed successfully',
  )
  @ApiOperation({ summary: 'Remove a service order (only if PENDING)' })
  removeServiceOrder(
    @Param('bookingId') bookingId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.removeServiceOrder(
      bookingId,
      orderId,
      user.id,
      user,
    );
  }

  // Results + Diagnosis
  @Get(':bookingId/results')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ResponseMessage(
    MessageCodes.MEDICAL_RECORD_RESULTS_RETRIEVED,
    'Visit results retrieved successfully',
  )
  @ApiOperation({
    summary: 'B4: Get visit results (service orders + existing diagnosis)',
  })
  getVisitResults(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.getVisitResults(bookingId, user);
  }

  @Patch(':bookingId/diagnose')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.MEDICAL_RECORD_DIAGNOSIS_SAVED,
    'Diagnosis and treatment plan saved successfully',
  )
  @ApiOperation({ summary: 'Save ICD-10 diagnosis and treatment plan' })
  saveDiagnosis(
    @Param('bookingId') bookingId: string,
    @Body() dto: SaveDiagnosisDto,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.saveDiagnosis(
      bookingId,
      dto,
      user.id,
      user,
    );
  }

  // Prescription
  @Post(':bookingId/prescriptions')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.PRESCRIPTION_SAVED,
    'Prescription saved successfully',
  )
  @ApiOperation({
    summary: 'Create/replace prescription (finalizes the visit)',
  })
  savePrescription(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.savePrescription(
      bookingId,
      dto,
      user.id,
      user,
    );
  }

  // B8 — Fulfill Prescription (BN mua thuốc tại phòng khám)
  @Patch(':bookingId/prescriptions/fulfill')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ResponseMessage(
    MessageCodes.PRESCRIPTION_FULFILLED,
    'Prescription marked as fulfilled successfully',
  )
  @ApiOperation({ summary: 'Mark prescription as fulfilled internally (B8)' })
  fulfillPrescription(
    @Param('bookingId') bookingId: string,
    @Body('pharmacyInvoiceId') pharmacyInvoiceId?: string,
  ) {
    return this.medicalRecordsService.fulfillPrescription(
      bookingId,
      pharmacyInvoiceId,
    );
  }

  // ICD-10 Search
  @Get('icd10')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ResponseMessage(
    MessageCodes.ICD10_SEARCH_SUCCESS,
    'ICD-10 search completed successfully',
  )
  @ApiOperation({ summary: 'Search ICD-10 codes for autocomplete' })
  searchICD10(@Query('q') q: string) {
    return this.medicalRecordsService.searchICD10(q || '');
  }

  // Patient History
  @Get('patient/:patientProfileId/history')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ResponseMessage(
    MessageCodes.PATIENT_HISTORY_RETRIEVED,
    'Patient visit history retrieved successfully',
  )
  @ApiOperation({ summary: 'Get patient visit history with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPatientHistory(
    @Param('patientProfileId') patientProfileId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: User,
  ) {
    return this.medicalRecordsService.getPatientHistory(
      patientProfileId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      user,
    );
  }

  // Patient self-service visits
  @Get('patient/my-visits')
  @Roles(UserRole.PATIENT)
  @ResponseMessage(
    MessageCodes.PATIENT_HISTORY_RETRIEVED,
    'Your visit history retrieved successfully',
  )
  @ApiOperation({ summary: 'Patient views their own visit history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMyVisits(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.medicalRecordsService.getMyVisits(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      user,
    );
  }

  // Patient visit stats
  @Get('patient/my-stats')
  @Roles(UserRole.PATIENT)
  @ResponseMessage(
    MessageCodes.PATIENT_STATS_RETRIEVED,
    'Patient visit stats retrieved successfully',
  )
  @ApiOperation({ summary: 'Patient visit stats for their dashboard' })
  getPatientStats(@CurrentUser() user: User) {
    return this.medicalRecordsService.getPatientStats(user.id, user);
  }

  // Doctor stats
  @Get('doctor/stats')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.DOCTOR_STATS_RETRIEVED,
    'Doctor stats retrieved successfully',
  )
  @ApiOperation({ summary: 'Doctor stats for their dashboard panel' })
  getDoctorStats(@CurrentUser() user: User) {
    return this.medicalRecordsService.getDoctorStats(user.id);
  }

  // B4' — Specialist Workflow
  @Patch('specialist-orders/:vsoId/start')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.SPECIALIST_EXAM_STARTED,
    'Specialist examination started successfully',
  )
  @ApiOperation({
    summary: 'Specialist calls patient and starts examination',
  })
  startSpecialistExamination(
    @Param('vsoId') vsoId: string,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.startSpecialistExamination(
      vsoId,
      user.id,
    );
  }

  @Patch('specialist-orders/:vsoId/complete')
  @Roles(UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.SPECIALIST_EXAM_COMPLETED,
    'Specialist examination completed successfully',
  )
  @ApiOperation({
    summary: 'Specialist records result and completes examination',
  })
  completeSpecialistExamination(
    @Param('vsoId') vsoId: string,
    @Body() dto: CompleteSpecialistExamDto,
    @CurrentUser() user: User,
  ) {
    return this.medicalRecordsService.completeSpecialistExamination(
      vsoId,
      user.id,
      dto,
    );
  }
}
