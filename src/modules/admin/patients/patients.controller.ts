import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminPatientsService } from './patients.service';
import { AdminCreatePatientDto } from './dto/create-patient.dto';
import { AdminUpdatePatientDto } from './dto/update-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('admin - patients')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/patients')
export class AdminPatientsController {
  constructor(private readonly patientsService: AdminPatientsService) {}

  /**
   * POST /admin/patients
   * Create a new patient record (ADMIN only).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new patient record (ADMIN only)',
    description:
      'Creates a new user with role PATIENT and an associated PatientProfile in a single transaction. ' +
      'The account is set as active and verified immediately. ' +
      'A default password (Patient@123) is assigned — the patient should change it on first login.',
  })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid request body',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  @ApiResponse({
    status: 409,
    description: 'Conflict — email or phone already exists',
  })
  create(@Body() dto: AdminCreatePatientDto) {
    return this.patientsService.create(dto);
  }

  /**
   * GET /admin/patients
   * Paginated, searchable, and filterable list of all patients.
   */
  @Get()
  @ApiOperation({
    summary: 'List and filter patients (ADMIN only)',
    description:
      'Returns a paginated list of patients. ' +
      'Supports full-text search and optional filters for gender, status, and blood type. ' +
      'Each row includes flattened fields ready for the Patient Management table: ' +
      'avatar, dateOfBirth, gender, phone, bloodType, lastVisit, nextAppointment, assignedDoctor, isActive.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Full-text search by name, email, phone, or insurance number',
  })
  @ApiQuery({
    name: 'gender',
    required: false,
    type: String,
    description: 'Comma-separated gender values: MALE, FEMALE, OTHER',
    example: 'MALE,FEMALE',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Comma-separated status values: active, inactive',
    example: 'active',
  })
  @ApiQuery({
    name: 'bloodType',
    required: false,
    type: String,
    description: 'Comma-separated blood type values (URL-encode the + sign)',
    example: 'A%2B,O%2B',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Patients retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  findAll(@Query() query: PatientSearchQueryDto) {
    return this.patientsService.findAll(query);
  }

  /**
   * GET /admin/patients/stats
   * KPI statistics for the Patient Management dashboard cards.
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get patient KPI statistics (ADMIN only)',
    description:
      'Returns the four KPI values displayed on the Patient Management page: ' +
      'totalPatients, newThisMonth, patientsToday, activeAppointments — ' +
      'each accompanied by a trend percentage vs the previous period.',
  })
  @ApiResponse({
    status: 200,
    description: 'Patient statistics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getStats() {
    return this.patientsService.getStats();
  }

  /**
   * GET /admin/patients/:id
   * Full detail of a single patient including PatientProfile.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get patient by ID (ADMIN only)',
    description:
      'Returns the full User record together with the PatientProfile (insurance, allergies, chronic conditions, etc.).',
  })
  @ApiParam({ name: 'id', description: 'Patient user UUID' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  /**
   * PATCH /admin/patients/:id
   * Update patient user fields and PatientProfile in one request.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update patient profile (ADMIN only)',
    description:
      'Updates User fields (name, phone, gender, dateOfBirth, address) and ' +
      'PatientProfile fields (insurance details, allergies, chronicConditions, familyHistory) ' +
      'atomically in a single transaction. All fields are optional — only provided fields are updated.',
  })
  @ApiParam({ name: 'id', description: 'Patient user UUID' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid request body',
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  update(@Param('id') id: string, @Body() dto: AdminUpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  /**
   * GET /admin/patients/:id/health-profile
   * Medical summary: allergies, chronic conditions, family history, vitals.
   */
  @Get(':id/health-profile')
  @ApiOperation({
    summary: 'Get patient health profile (ADMIN only)',
    description:
      'Returns the medical summary section of the PatientProfile: ' +
      'allergies, chronicConditions, familyHistory, bloodType, heightCm, weightKg.',
  })
  @ApiParam({ name: 'id', description: 'Patient user UUID' })
  @ApiResponse({
    status: 200,
    description: 'Patient health profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getHealthProfile(@Param('id') id: string) {
    return this.patientsService.getHealthProfile(id);
  }
}
