import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, Prisma } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { MessageCodes } from '../../../common/constants/message-codes.const';

import { AdminCreateServiceDto } from './dto/admin-create-service.dto';
import { AdminUpdateServiceDto } from './dto/admin-update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';

@Injectable()
export class AdminServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getServiceStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalServices, activeServices, newThisMonth] = await Promise.all([
      this.prisma.service.count(),
      this.prisma.service.count({ where: { isActive: true } }),
      this.prisma.service.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    // Most booked service (by completed bookings)
    const topBooking = await this.prisma.booking.groupBy({
      by: ['serviceId'],
      where: { status: BookingStatus.COMPLETED },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    let mostBooked: { id: string; name: string; bookingCount: number } | null =
      null;
    if (topBooking.length > 0) {
      const svc = await this.prisma.service.findUnique({
        where: { id: topBooking[0].serviceId },
        select: { id: true, name: true },
      });
      if (svc) {
        mostBooked = {
          id: svc.id,
          name: svc.name,
          bookingCount: topBooking[0]._count.id,
        };
      }
    }

    return ResponseHelper.success(
      {
        totalServices,
        activeServices,
        inactiveServices: totalServices - activeServices,
        newThisMonth,
        mostBooked,
      },
      'ADMIN.SERVICES.STATISTICS',
      'Service statistics retrieved successfully',
      200,
    );
  }

  /**
   * GET /admin/services
   * List all services with optional search / isActive filter.
   */
  async findAllServices(filterDto: FilterServiceDto) {
    const { isActive, search, category, page = 1, limit = 10 } = filterDto;
    const where: Prisma.ServiceWhereInput = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (category && category !== 'all') {
      where.categoryId = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        services,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      'ADMIN.SERVICES.LIST',
      'Services retrieved successfully',
      200,
    );
  }

  /**
   * GET /admin/services/:id
   * Detail of a single service with booking stats.
   */
  async findOneService(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service retrieval failed',
      );
    }

    const [totalBookings, completedBookings, cancelledBookings] =
      await Promise.all([
        this.prisma.booking.count({ where: { serviceId: id } }),
        this.prisma.booking.count({
          where: { serviceId: id, status: BookingStatus.COMPLETED },
        }),
        this.prisma.booking.count({
          where: { serviceId: id, status: BookingStatus.CANCELLED },
        }),
      ]);

    return ResponseHelper.success(
      {
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
      },
      'ADMIN.SERVICES.DETAIL',
      'Service retrieved successfully',
      200,
    );
  }

  /**
   * POST /admin/services
   * Create a new service.
   */
  async createService(dto: AdminCreateServiceDto) {
    // Duplicate name check
    const existing = await this.prisma.service.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ApiException(
        MessageCodes.SERVICE_NAME_EXISTS,
        'Service with this name already exists',
        409,
        'Service creation failed',
      );
    }

    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        iconUrl: dto.iconUrl,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        maxSlotsPerHour: dto.maxSlotsPerHour,
        categoryId: dto.categoryId,
        preparationNotes: dto.preparationNotes,
        tags: dto.tags || [],
        isActive: dto.isActive ?? true,
      },
    });

    return ResponseHelper.success(
      service,
      'ADMIN.SERVICES.CREATED',
      'Service created successfully',
      201,
    );
  }

  /**
   * PATCH /admin/services/:id
   * Update service fields.
   */
  async updateService(id: string, dto: AdminUpdateServiceDto) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
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
      const duplicate = await this.prisma.service.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ApiException(
          MessageCodes.SERVICE_NAME_EXISTS,
          'Service with this name already exists',
          409,
          'Service update failed',
        );
      }
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
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
      },
    });

    return ResponseHelper.success(
      updated,
      'ADMIN.SERVICES.UPDATED',
      'Service updated successfully',
      200,
    );
  }

  /**
   * DELETE /admin/services/:id
   * Soft-delete a service (sets isActive = false).
   * Blocked if service has active bookings.
   */
  async removeService(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Service deletion failed',
      );
    }

    const activeBookings = await this.prisma.booking.count({
      where: {
        serviceId: id,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
      },
    });
    if (activeBookings > 0) {
      throw new BadRequestException(
        'Cannot delete service with active bookings',
      );
    }

    const deleted = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    return ResponseHelper.success(
      deleted,
      'ADMIN.SERVICES.DELETED',
      'Service deleted successfully',
      200,
    );
  }

  /**
   * PATCH /admin/services/:id/restore
   * Restore a soft-deleted service.
   */
  async restoreService(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
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

    const restored = await this.prisma.service.update({
      where: { id },
      data: { isActive: true },
    });

    return ResponseHelper.success(
      restored,
      'ADMIN.SERVICES.RESTORED',
      'Service restored successfully',
      200,
    );
  }
}
