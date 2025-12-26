import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new service (ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'Service created successfully',
    schema: {
      example: {
        id: 'uuid',
        name: 'Khám tổng quát',
        description: 'Khám sức khỏe định kỳ',
        durationMinutes: 30,
        price: 200000,
        maxSlotsPerHour: 3,
        isActive: true,
        createdAt: '2024-12-26T10:00:00Z',
        updatedAt: '2024-12-26T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Service with this name already exists',
  })
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all services (public)' })
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
  @ApiResponse({
    status: 200,
    description: 'List of services',
    schema: {
      example: [
        {
          id: 'uuid',
          name: 'Khám tổng quát',
          description: 'Khám sức khỏe định kỳ',
          durationMinutes: 30,
          price: 200000,
          maxSlotsPerHour: 3,
          isActive: true,
        },
      ],
    },
  })
  findAll(
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const filters: { isActive?: boolean; search?: string } = {};

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    if (search) {
      filters.search = search;
    }

    return this.servicesService.findAll(filters);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get service by ID (public)' })
  @ApiResponse({
    status: 200,
    description: 'Service details',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found',
  })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Get(':id/statistics')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Get service statistics (ADMIN/RECEPTIONIST only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service statistics',
    schema: {
      example: {
        service: {
          id: 'uuid',
          name: 'Khám tổng quát',
        },
        statistics: {
          totalBookings: 150,
          completedBookings: 120,
          cancelledBookings: 20,
          completionRate: 80,
        },
      },
    },
  })
  getStatistics(@Param('id') id: string) {
    return this.servicesService.getStatistics(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update service (ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Service updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Service with this name already exists',
  })
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete service (soft delete, ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Service deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete service with active bookings',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found',
  })
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore deleted service (ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Service restored successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found',
  })
  restore(@Param('id') id: string) {
    return this.servicesService.restore(id);
  }
}
