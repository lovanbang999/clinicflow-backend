import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Prisma } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new service
   */
  async create(createServiceDto: CreateServiceDto) {
    const { name, description, durationMinutes, price, maxSlotsPerHour } =
      createServiceDto;

    // Check for duplicate service name
    const existingService = await this.prisma.service.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        isActive: true,
      },
    });

    if (existingService) {
      throw new ApiException(
        MessageCodes.SERVICE_NAME_EXISTS,
        'Service with this name already exists',
        409,
        'Service creation failed',
      );
    }

    // Validate business rules
    if (durationMinutes <= 0 || durationMinutes > 120) {
      throw new BadRequestException(
        'Duration must be between 1 and 120 minutes',
      );
    }

    if (maxSlotsPerHour <= 0 || maxSlotsPerHour > 10) {
      throw new BadRequestException(
        'Max slots per hour must be between 1 and 10',
      );
    }

    if (price < 0) {
      throw new BadRequestException('Price must be non-negative');
    }

    // Create service
    const service = await this.prisma.service.create({
      data: {
        name,
        description,
        durationMinutes,
        price,
        maxSlotsPerHour,
        isActive: true,
      },
    });

    return ResponseHelper.success(
      service,
      MessageCodes.SERVICE_CREATED,
      'Service created successfully',
      201,
    );
  }

  /**
   * Get all services with optional filters
   */
  async findAll(filters?: { isActive?: boolean; search?: string }) {
    const where: Prisma.ServiceWhereInput = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        {
          name: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const services = await this.prisma.service.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return ResponseHelper.success(
      services,
      MessageCodes.SERVICE_LIST_RETRIEVED,
      'Services retrieved successfully',
      200,
    );
  }

  /**
   * Get service by ID
   */
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service retrieval failed',
      );
    }

    return ResponseHelper.success(
      service,
      MessageCodes.SERVICE_RETRIEVED,
      'Service retrieved successfully',
      200,
    );
  }

  /**
   * Update service
   */
  async update(id: string, updateServiceDto: UpdateServiceDto) {
    // Check if service exists
    const existingService = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service update failed',
      );
    }

    const { name, durationMinutes, price, maxSlotsPerHour } = updateServiceDto;

    // If updating name, check for duplicates
    if (name) {
      const duplicateService = await this.prisma.service.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          isActive: true,
          id: {
            not: id,
          },
        },
      });

      if (duplicateService) {
        throw new ApiException(
          MessageCodes.SERVICE_NAME_EXISTS,
          'Service with this name already exists',
          409,
          'Service update failed',
        );
      }
    }

    // Validate business rules if provided
    if (durationMinutes !== undefined) {
      if (durationMinutes <= 0 || durationMinutes > 120) {
        throw new BadRequestException(
          'Duration must be between 1 and 120 minutes',
        );
      }
    }

    if (maxSlotsPerHour !== undefined) {
      if (maxSlotsPerHour <= 0 || maxSlotsPerHour > 10) {
        throw new BadRequestException(
          'Max slots per hour must be between 1 and 10',
        );
      }
    }

    if (price !== undefined && price < 0) {
      throw new BadRequestException('Price must be non-negative');
    }

    // Update service
    const updatedService = await this.prisma.service.update({
      where: { id },
      data: updateServiceDto,
    });

    return ResponseHelper.success(
      updatedService,
      MessageCodes.SERVICE_UPDATED,
      'Service updated successfully',
      200,
    );
  }

  /**
   * Soft delete service
   */
  async remove(id: string) {
    // Check if service exists
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service deletion failed',
      );
    }

    // Check if service is being used in any active bookings
    const activeBookings = await this.prisma.booking.count({
      where: {
        serviceId: id,
        status: {
          in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
        },
      },
    });

    if (activeBookings > 0) {
      throw new ApiException(
        MessageCodes.SERVICE_HAS_ACTIVE_BOOKINGS,
        'Cannot delete service with active bookings',
        400,
        'Service deletion failed',
      );
    }

    // Soft delete
    const deletedService = await this.prisma.service.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return ResponseHelper.success(
      deletedService,
      MessageCodes.SERVICE_DELETED,
      'Service deleted successfully',
      200,
    );
  }

  /**
   * Restore soft-deleted service
   */
  async restore(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service restore failed',
      );
    }

    if (service.isActive) {
      throw new BadRequestException('Service is already active');
    }

    const restoredService = await this.prisma.service.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    return ResponseHelper.success(
      restoredService,
      MessageCodes.SERVICE_RESTORED,
      'Service restored successfully',
      200,
    );
  }

  /**
   * Get service statistics
   */
  async getStatistics(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Statistics retrieval failed',
      );
    }

    const [totalBookings, completedBookings, cancelledBookings] =
      await Promise.all([
        this.prisma.booking.count({
          where: { serviceId },
        }),
        this.prisma.booking.count({
          where: { serviceId, status: 'COMPLETED' },
        }),
        this.prisma.booking.count({
          where: { serviceId, status: 'CANCELLED' },
        }),
      ]);

    return ResponseHelper.success(
      {
        service: {
          id: service.id,
          name: service.name,
        },
        statistics: {
          totalBookings,
          completedBookings,
          cancelledBookings,
          completionRate:
            totalBookings > 0
              ? Math.round((completedBookings / totalBookings) * 100)
              : 0,
        },
      },
      MessageCodes.SERVICE_STATISTICS_RETRIEVED,
      'Service statistics retrieved successfully',
      200,
    );
  }
}
