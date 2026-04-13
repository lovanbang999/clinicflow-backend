import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { UploadService } from '../upload/upload.service';
import {
  ICatalogRepository,
  I_CATALOG_REPOSITORY,
} from '../database/interfaces/catalog.repository.interface';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../database/interfaces/booking.repository.interface';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Prisma } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class ServicesService {
  constructor(
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Create a new service
   */
  async create(createServiceDto: CreateServiceDto) {
    const {
      name,
      description,
      iconUrl,
      durationMinutes,
      price,
      maxSlotsPerHour,
      categoryId,
    } = createServiceDto;

    const category = await this.catalogRepository.findCategoryById(categoryId);
    if (!category) {
      throw new BadRequestException('Invalid category ID');
    }

    // Check for duplicate service name
    const existingService =
      await this.catalogRepository.findServiceByName(name);

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
    const service = await this.catalogRepository.createService({
      name,
      description,
      iconUrl,
      durationMinutes,
      price,
      maxSlotsPerHour,
      categoryId,
      isActive: true,
      tags: [],
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
  async findAll(filters?: {
    isActive?: boolean;
    search?: string;
    category?: string;
    categoryType?: 'EXAMINATION' | 'LAB';
    performedBy?: 'TECHNICIAN' | 'DOCTOR';
  }) {
    const where: Prisma.ServiceWhereInput = {};

    if (filters?.category && filters.category !== 'all') {
      where.categoryId = filters.category;
    }

    if (filters?.categoryType) {
      where.category = {
        ...(where.category
          ? (where.category as Prisma.CategoryWhereInput)
          : {}),
        type: filters.categoryType,
      };
    }

    if (filters?.performedBy) {
      where.performerType = filters.performedBy;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        {
          name: {
            contains: filters.search,
          },
        },
        {
          description: {
            contains: filters.search,
          },
        },
      ];
    }

    const services = await this.catalogRepository.findManyServices({
      where,
      include: {
        category: true,
        doctorServices: {
          include: {
            doctorProfile: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
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
    const service = await this.catalogRepository.findServiceById(id);

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
    const existingService = await this.catalogRepository.findServiceById(id);

    if (!existingService) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service update failed',
      );
    }

    const {
      name,
      iconUrl,
      durationMinutes,
      price,
      maxSlotsPerHour,
      categoryId,
    } = updateServiceDto;

    if (categoryId) {
      const cat = await this.catalogRepository.findCategoryById(categoryId);
      if (!cat) throw new BadRequestException('Invalid category ID');
    }

    // If updating name, check for duplicates
    if (name) {
      const duplicateService = await this.catalogRepository.findServiceByName(
        name,
        id,
      );

      if (duplicateService) {
        throw new ApiException(
          MessageCodes.SERVICE_NAME_EXISTS,
          'Service with this name already exists',
          409,
          'Service update failed',
        );
      }
    }

    // If updating icon, delete old icon
    if (
      iconUrl &&
      existingService.iconUrl &&
      iconUrl !== existingService.iconUrl
    ) {
      await this.uploadService.deleteIcon(existingService.iconUrl);
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
    const updatedService = await this.catalogRepository.updateService(
      id,
      updateServiceDto,
    );

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
    const service = await this.catalogRepository.findServiceById(id);

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service deletion failed',
      );
    }

    // Check if service is being used in any active bookings
    const activeBookings = await this.bookingRepository.countBookingsByService(
      id,
      ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
    );

    if (activeBookings > 0) {
      throw new ApiException(
        MessageCodes.SERVICE_HAS_ACTIVE_BOOKINGS,
        'Cannot delete service with active bookings',
        400,
        'Service deletion failed',
      );
    }

    // Delete icon if exists
    if (service.iconUrl) {
      await this.uploadService.deleteIcon(service.iconUrl);
    }

    // Soft delete
    const deletedService = await this.catalogRepository.updateService(id, {
      isActive: false,
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
    const service = await this.catalogRepository.findServiceById(id);

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

    const restoredService = await this.catalogRepository.updateService(id, {
      isActive: true,
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
    const service = await this.catalogRepository.findServiceById(serviceId);

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
        this.bookingRepository.countBookingsByService(serviceId),
        this.bookingRepository.countBookingsByService(serviceId, ['COMPLETED']),
        this.bookingRepository.countBookingsByService(serviceId, ['CANCELLED']),
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
