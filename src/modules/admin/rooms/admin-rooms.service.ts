import { Injectable, HttpStatus, Inject } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions/api.exception';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FilterRoomDto } from './dto/filter-room.dto';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import {
  ICatalogRepository,
  I_CATALOG_REPOSITORY,
} from '../../database/interfaces/catalog.repository.interface';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../../database/interfaces/booking.repository.interface';

@Injectable()
export class AdminRoomsService {
  constructor(
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async findAll(filter: FilterRoomDto) {
    const { search, isActive, page = 1, limit = 20 } = filter;

    const parsedIsActive =
      isActive !== undefined
        ? String(isActive) === 'true'
          ? true
          : String(isActive) === 'false'
            ? false
            : undefined
        : undefined;

    const [rooms, total] = await this.catalogRepository.findAdminRoomsPage(
      { search, isActive: parsedIsActive },
      page,
      limit,
    );

    return {
      rooms,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const room = await this.catalogRepository.findAdminRoomDetailById(id);

    if (!room) {
      throw new ApiException(
        MessageCodes.ROOM_NOT_FOUND,
        'Room not found',
        404,
        'Room retrieval failed',
      );
    }

    return room;
  }

  async create(dto: CreateRoomDto) {
    const existing = await this.catalogRepository.findRoomByName(dto.name);
    if (existing) {
      throw new ApiException(
        MessageCodes.ROOM_NAME_EXISTS,
        'Room with this name already exists',
        409,
        'Room creation failed',
      );
    }

    const room = await this.catalogRepository.createRoom({
      name: dto.name,
      type: dto.type,
      floor: dto.floor,
      capacity: dto.capacity ?? 1,
      notes: dto.notes,
      isActive: dto.isActive ?? true,
    });

    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    const existing = await this.catalogRepository.findAdminRoomDetailById(id);
    if (!existing) {
      throw new ApiException(
        MessageCodes.ROOM_NOT_FOUND,
        'Room not found',
        404,
        'Room update failed',
      );
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.catalogRepository.findRoomByName(dto.name);
      if (duplicate) {
        throw new ApiException(
          MessageCodes.ROOM_NAME_EXISTS,
          'Room with this name already exists',
          409,
          'Room update failed',
        );
      }
    }

    const updated = await this.catalogRepository.updateRoom(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.floor !== undefined && { floor: dto.floor }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return updated;
  }

  async remove(id: string) {
    const room = await this.catalogRepository.findAdminRoomDetailById(id);
    if (!room) {
      throw new ApiException(
        MessageCodes.ROOM_NOT_FOUND,
        'Room not found',
        404,
        'Room deactivation failed',
      );
    }

    // Block delete if room has upcoming/active schedule slots
    const now = new Date();
    const activeSlots =
      await this.bookingRepository.countActiveScheduleSlotsForRoom(id, now);

    if (activeSlots > 0) {
      throw new ApiException(
        MessageCodes.ROOM_HAS_ACTIVE_SLOTS,
        `This room still has ${activeSlots} active schedule slots.`,
        HttpStatus.BAD_REQUEST,
        'Cannot deactivate room',
      );
    }

    const updated = await this.catalogRepository.updateRoom(id, {
      isActive: false,
    });

    return updated;
  }

  async restore(id: string) {
    const room = await this.catalogRepository.findAdminRoomDetailById(id);
    if (!room) {
      throw new ApiException(
        MessageCodes.ROOM_NOT_FOUND,
        'Room not found',
        404,
        'Room restore failed',
      );
    }

    if (room.isActive) {
      throw new ApiException(
        MessageCodes.ROOM_ALREADY_ACTIVE,
        'Room is already active',
        HttpStatus.BAD_REQUEST,
        'Room restore failed',
      );
    }

    const updated = await this.catalogRepository.updateRoom(id, {
      isActive: true,
    });

    return updated;
  }
}
