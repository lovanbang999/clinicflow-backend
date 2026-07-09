import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import {
  I_CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../database/interfaces/catalog.repository.interface';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../database/interfaces/booking.repository.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { AdminCreateServiceDto } from './dto/admin-create-service.dto';
import { AdminUpdateServiceDto } from './dto/admin-update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';

@Injectable()
export class AdminServicesService {
  constructor(
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async getServiceStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [stats, topBooking] = await Promise.all([
      this.catalogRepository.getServiceDashboardStats(startOfMonth),
      this.bookingRepository.getMostBookedServiceId(),
    ]);

    let mostBooked: { id: string; name: string; bookingCount: number } | null =
      null;
    if (topBooking) {
      const svc = await this.catalogRepository.findServiceDetailById(
        topBooking.serviceId,
      );
      if (svc) {
        mostBooked = {
          id: svc.id,
          name: svc.name,
          bookingCount: topBooking.count,
        };
      }
    }

    return {
      totalServices: stats.totalServices,
      activeServices: stats.activeServices,
      inactiveServices: stats.totalServices - stats.activeServices,
      newThisMonth: stats.newThisMonth,
      mostBooked,
    };
  }

  /**
   * GET /admin/services
   * List all services with optional search / isActive filter.
   */
  async findAllServices(filterDto: FilterServiceDto) {
    const { isActive, search, category, page = 1, limit = 10 } = filterDto;

    const [services, total] =
      await this.catalogRepository.findAdminServicesPage(
        { isActive, search, category },
        page,
        limit,
      );

    return {
      services,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/services/:id
   * Detail of a single service with booking stats.
   */
  async findOneService(id: string) {
    const service = await this.catalogRepository.findServiceDetailById(id);
    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service retrieval failed',
      );
    }

    const { totalBookings, completedBookings, cancelledBookings } =
      await this.bookingRepository.getServiceBookingStats(id);

    return {
      ...service,
      stats: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        completionRate:
          totalBookings > 0
            ? Math.round((completedBookings / totalBookings) * 100)
            : 0,
      },
    };
  }

  /**
   * POST /admin/services
   * Create a new service.
   */
  async createService(dto: AdminCreateServiceDto) {
    // Duplicate name check
    const existing = await this.catalogRepository.findServiceByName(dto.name);
    if (existing) {
      throw new ApiException(
        MessageCodes.SERVICE_NAME_EXISTS,
        'Service with this name already exists',
        409,
        'Service creation failed',
      );
    }

    const service = await this.catalogRepository.createService({
      name: dto.name,
      description: dto.description,
      iconUrl: dto.iconUrl,
      price: dto.price,
      durationMinutes: dto.durationMinutes,
      maxSlotsPerHour: dto.maxSlotsPerHour,
      isActive: true,
      categoryId: dto.categoryId,
      preparationNotes: dto.preparationNotes,
      tags: dto.tags ?? [],
    });

    return service;
  }

  /**
   * PATCH /admin/services/:id
   * Update service fields.
   */
  async updateService(id: string, dto: AdminUpdateServiceDto) {
    const existing = await this.catalogRepository.findServiceDetailById(id);
    if (!existing) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service update failed',
      );
    }

    // Duplicate name check (exclude self)
    if (dto.name) {
      const duplicate = await this.catalogRepository.findServiceByName(
        dto.name,
        id,
      );
      if (duplicate) {
        throw new ApiException(
          MessageCodes.SERVICE_NAME_EXISTS,
          'Service with this name already exists',
          409,
          'Service update failed',
        );
      }
    }

    const updated = await this.catalogRepository.updateService(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.durationMinutes !== undefined && {
        durationMinutes: dto.durationMinutes,
      }),
      ...(dto.maxSlotsPerHour !== undefined && {
        maxSlotsPerHour: dto.maxSlotsPerHour,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.preparationNotes !== undefined && {
        preparationNotes: dto.preparationNotes,
      }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
    });

    return updated;
  }

  /**
   * DELETE /admin/services/:id
   * Soft-delete a service (sets isActive = false).
   * Blocked if service has active bookings.
   */
  async removeService(id: string) {
    const service = await this.catalogRepository.findServiceDetailById(id);
    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service deletion failed',
      );
    }

    const activeBookings =
      await this.bookingRepository.countActiveBookingsForService(id);
    if (activeBookings > 0) {
      throw new BadRequestException(
        'Cannot delete service with active bookings',
      );
    }

    const deleted = await this.catalogRepository.updateService(id, {
      isActive: false,
    });

    return deleted;
  }

  /**
   * PATCH /admin/services/:id/restore
   * Restore a soft-deleted service.
   */
  async restoreService(id: string) {
    const service = await this.catalogRepository.findServiceDetailById(id);
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

    const restored = await this.catalogRepository.updateService(id, {
      isActive: true,
    });

    return restored;
  }
}
