import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Medical Records')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post()
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Create or Update Medical Record',
    description:
      'Saves the consultation result, diagnosis (ICD-10) and prescriptions for a booking',
  })
  @ApiResponse({
    status: 200,
    description: 'Medical record saved successfully',
  })
  upsertMedicalRecord(
    @Body() dto: CreateMedicalRecordDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.medicalRecordsService.upsertMedicalRecord(dto, req.user.id);
  }

  @Get('icd10')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Search ICD-10 Codes',
    description: 'Provides autocomplete functionality for ICD-10 codes',
  })
  searchICD10(@Query('q') q: string) {
    return this.medicalRecordsService.searchICD10(q || '');
  }

  @Get('patient/:patientProfileId/history')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Patient Medical History',
    description:
      'Retrieves comprehensive medical profile and recent visits for a required patient profile id (accessible by Doctor/Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Patient history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Patient profile not found' })
  getPatientHistory(@Param('patientProfileId') patientProfileId: string) {
    return this.medicalRecordsService.getPatientHistory(patientProfileId);
  }
}
