import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
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

import { AdminServicesService } from './admin-services.service';
import { AdminCreateServiceDto } from './dto/admin-create-service.dto';
import { AdminUpdateServiceDto } from './dto/admin-update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';
import { ServiceStatsResponseDto } from './dto/service-stats.response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('admin - services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminServicesController {
  constructor(private readonly servicesService: AdminServicesService) {}

  /**
   * GET /admin/services/statistics
   * Stat cards for the Service Management page.
   */
  @Get('services/statistics')
  @ApiOperation({
    summary: 'Service statistics (ADMIN only)',
    description:
      'Returns totalServices, activeServices, inactiveServices, newThisMonth ' +
      'and mostBooked service. Used to populate the stat cards on the Service Management page.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: ServiceStatsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getServiceStatistics() {
    return this.servicesService.getServiceStatistics();
  }

  /**
   * GET /admin/services
   * List all services with optional search / isActive filter.
   */
  @Get('services')
  @ApiOperation({
    summary: 'List all services (ADMIN only)',
    description:
      'Returns all services. Supports filtering by isActive and free-text search.',
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
    description: 'Search by name or description',
  })
  @ApiResponse({ status: 200, description: 'Services retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getServices(@Query() filterDto: FilterServiceDto) {
    return this.servicesService.findAllServices(filterDto);
  }

  /**
   * GET /admin/services/:id
   * Detail of a single service including booking statistics.
   */
  @Get('services/:id')
  @ApiOperation({ summary: 'Get service by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getServiceById(@Param('id') id: string) {
    return this.servicesService.findOneService(id);
  }

  /**
   * POST /admin/services
   * Create a new service.
   */
  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new service (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  @ApiResponse({ status: 409, description: 'Service name already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  createService(@Body() dto: AdminCreateServiceDto) {
    return this.servicesService.createService(dto);
  }

  /**
   * PATCH /admin/services/:id
   * Update service fields.
   */
  @Patch('services/:id')
  @ApiOperation({ summary: 'Update service (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 409, description: 'Service name already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  updateService(@Param('id') id: string, @Body() dto: AdminUpdateServiceDto) {
    return this.servicesService.updateService(id, dto);
  }

  /**
   * DELETE /admin/services/:id
   * Soft-delete a service (sets isActive = false).
   */
  @Delete('services/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a service (ADMIN only)',
    description: 'Sets isActive=false. Blocked if service has active bookings.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete — service has active bookings',
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  deleteService(@Param('id') id: string) {
    return this.servicesService.removeService(id);
  }

  /**
   * PATCH /admin/services/:id/restore
   * Restore a soft-deleted service.
   */
  @Patch('services/:id/restore')
  @ApiOperation({ summary: 'Restore a deleted service (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service restored successfully' })
  @ApiResponse({ status: 400, description: 'Service is already active' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  restoreService(@Param('id') id: string) {
    return this.servicesService.restoreService(id);
  }
}
