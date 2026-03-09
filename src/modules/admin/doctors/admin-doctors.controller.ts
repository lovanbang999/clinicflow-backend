import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { AdminDoctorsService } from './admin-doctors.service';
import { FilterDoctorDto } from './dto/filter-doctor.dto';
import { AdminUpdateDoctorProfileDto } from './dto/admin-update-doctor-profile.dto';
import { AdminSuspendUserDto } from '../users/dto/admin-suspend-user.dto';
import { DoctorStatsResponseDto } from './dto/doctor-stats.response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('admin - doctors')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminDoctorsController {
  constructor(private readonly doctorsService: AdminDoctorsService) {}

  /**
   * GET /admin/doctors/statistics
   * Doctor statistics (ADMIN only)
   */
  @Get('doctors/statistics')
  @ApiOperation({
    summary: 'Doctor statistics (ADMIN only)',
    description:
      'Returns totalDoctors, activeDoctors, inactiveDoctors, newThisMonth ' +
      'and a bySpecialty breakdown. Feeds the 4 stat cards on the Doctor Management page.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: DoctorStatsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getDoctorStatistics() {
    return this.doctorsService.getDoctorStatistics();
  }

  /**
   * GET /admin/doctors
   * Paginated & filterable list of all users with role DOCTOR.
   */
  @Get('doctors')
  @ApiOperation({
    summary: 'List all doctors (ADMIN only)',
    description:
      'Returns a paginated, filterable list of doctors. ' +
      'Supports filtering by specialty, isActive, and full-text search.',
  })
  @ApiQuery({
    name: 'specialty',
    required: false,
    type: String,
    description: 'Filter by specialty',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Doctors retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getDoctors(@Query() filterDto: FilterDoctorDto) {
    return this.doctorsService.findAllDoctors(filterDto);
  }

  /**
   * GET /admin/doctors/:id
   * Full detail of a single doctor including booking stats.
   */
  @Get('doctors/:id')
  @ApiOperation({ summary: 'Get doctor by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Doctor user UUID' })
  @ApiResponse({ status: 200, description: 'Doctor retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getDoctorById(@Param('id') id: string) {
    return this.doctorsService.findOneDoctor(id);
  }

  /**
   * PATCH /admin/doctors/:id/profile
   * Update DoctorProfile fields (specialties, qualifications, experience, bio).
   */
  @Patch('doctors/:id/profile')
  @ApiOperation({
    summary: 'Update doctor profile (ADMIN only)',
    description:
      'Updates the DoctorProfile record. Upserts if the profile does not exist yet. ' +
      'Use this to manage specialties, qualifications, years of experience and bio.',
  })
  @ApiParam({ name: 'id', description: 'Doctor user UUID' })
  @ApiResponse({
    status: 200,
    description: 'Doctor profile updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  updateDoctorProfile(
    @Param('id') id: string,
    @Body() dto: AdminUpdateDoctorProfileDto,
  ) {
    return this.doctorsService.updateDoctorProfile(id, dto);
  }

  /**
   * PATCH /admin/doctors/:id/status
   * Suspend or reinstate a doctor account.
   */
  @Patch('doctors/:id/status')
  @ApiOperation({
    summary: 'Suspend or reinstate a doctor (ADMIN only)',
    description:
      'Toggles the isActive flag on the doctor account. ' +
      'Pass { isActive: false } to suspend, { isActive: true } to reinstate.',
  })
  @ApiParam({ name: 'id', description: 'Doctor user UUID' })
  @ApiResponse({
    status: 200,
    description: 'Doctor status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  toggleDoctorStatus(
    @Param('id') id: string,
    @Body() dto: AdminSuspendUserDto,
  ) {
    return this.doctorsService.toggleDoctorActive(id, dto);
  }
}
