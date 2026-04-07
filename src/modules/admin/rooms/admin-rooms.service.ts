import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FilterRoomDto } from './dto/filter-room.dto';

@Injectable()
export class AdminRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterRoomDto) {
    const { search, isActive, page = 1, limit = 20 } = filter;

    const where: Prisma.RoomWhereInput = {};

    if (isActive !== undefined) {
      if (String(isActive) === 'true') {
        where.isActive = true;
      } else if (String(isActive) === 'false') {
        where.isActive = false;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        include: {
          _count: { select: { scheduleSlots: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.room.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        rooms,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      'ADMIN.ROOMS.LIST',
      'Rooms retrieved successfully',
      200,
    );
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        _count: { select: { scheduleSlots: true } },
      },
    });

    if (!room) {
      throw new ApiException(
        'ROOM_NOT_FOUND',
        'Room not found',
        404,
        'Room retrieval failed',
      );
    }

    return ResponseHelper.success(
      room,
      'ADMIN.ROOMS.DETAIL',
      'Room retrieved successfully',
      200,
    );
  }

  async create(dto: CreateRoomDto) {
    const existing = await this.prisma.room.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ApiException(
        'ROOM_NAME_EXISTS',
        'Room with this name already exists',
        409,
        'Room creation failed',
      );
    }

    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        type: dto.type,
        floor: dto.floor,
        capacity: dto.capacity ?? 1,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
      },
    });

    return ResponseHelper.success(
      room,
      'ADMIN.ROOMS.CREATED',
      'Room created successfully',
      201,
    );
  }

  async update(id: string, dto: UpdateRoomDto) {
    const existing = await this.prisma.room.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException(
        'ROOM_NOT_FOUND',
        'Room not found',
        404,
        'Room update failed',
      );
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.room.findUnique({
        where: { name: dto.name },
      });
      if (duplicate) {
        throw new ApiException(
          'ROOM_NAME_EXISTS',
          'Room with this name already exists',
          409,
          'Room update failed',
        );
      }
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.floor !== undefined && { floor: dto.floor }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return ResponseHelper.success(
      updated,
      'ADMIN.ROOMS.UPDATED',
      'Room updated successfully',
      200,
    );
  }

  async remove(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new ApiException(
        'ROOM_NOT_FOUND',
        'Room not found',
        404,
        'Room deletion failed',
      );
    }

    // Block delete if room has upcoming/active schedule slots
    const now = new Date();
    const activeSlots = await this.prisma.doctorScheduleSlot.count({
      where: {
        roomId: id,
        date: { gte: now },
        isActive: true,
      },
    });

    if (activeSlots > 0) {
      throw new ApiException(
        'ROOM_HAS_ACTIVE_SLOTS',
        `Không thể ngừng hoạt động phòng này vì còn ${activeSlots} lịch khám đang dùng phòng này.`,
        HttpStatus.BAD_REQUEST,
        'Cannot deactivate room',
      );
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });

    return ResponseHelper.success(
      updated,
      'ADMIN.ROOMS.DELETED',
      'Room deactivated successfully',
      200,
    );
  }

  async restore(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new ApiException(
        'ROOM_NOT_FOUND',
        'Room not found',
        404,
        'Room restore failed',
      );
    }

    if (room.isActive) {
      throw new ApiException(
        'ROOM_ALREADY_ACTIVE',
        'Room is already active',
        HttpStatus.BAD_REQUEST,
        'Room restore failed',
      );
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: { isActive: true },
    });

    return ResponseHelper.success(
      updated,
      'ADMIN.ROOMS.RESTORED',
      'Room restored successfully',
      200,
    );
  }
}
