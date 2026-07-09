import { Prisma } from '@prisma/client';
import { Injectable, Inject } from '@nestjs/common';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../../database/interfaces/booking.repository.interface';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../../database/interfaces/user.repository.interface';
import {
  ICatalogRepository,
  I_CATALOG_REPOSITORY,
} from '../../database/interfaces/catalog.repository.interface';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { ApiException } from '../../../common/exceptions/api.exception';

@Injectable()
export class AdminSchedulesService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async getRooms() {
    const rooms = await this.catalogRepository.findActiveRooms();
    return rooms;
  }

  async getStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const stats = await this.bookingRepository.getScheduleDashboardStats(
      today,
      endOfToday,
    );

    return stats;
  }

  async findAll(filters: FilterScheduleDto) {
    const slots = await this.bookingRepository.findAdminScheduleSlots(filters);

    return {
      data: slots,
      meta: {
        total: slots.length,
      },
    };
  }

  private async findById(id: string) {
    const slot = await this.bookingRepository.findAdminScheduleSlotDetail(id);

    if (!slot) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Schedule slot not found',
        404,
        'Schedule lookup failed',
      );
    }

    return slot;
  }

  async findOne(id: string) {
    const slot = await this.findById(id);

    return slot;
  }

  async create(createDto: CreateScheduleDto) {
    const doctor = await this.userRepository.findDoctorWithProfile(
      createDto.doctorId,
    );

    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Schedule creation failed',
      );
    }

    const roomId =
      createDto.roomId && createDto.roomId !== 'none'
        ? createDto.roomId
        : doctor.doctorProfile?.roomId || undefined;

    const newSlot = await this.bookingRepository.createScheduleSlot({
      ...createDto,
      roomId,
      date: new Date(createDto.date),
    });

    return newSlot;
  }

  async update(id: string, updateDto: UpdateScheduleDto) {
    await this.findById(id); // Check exists

    // Format date string to Date object if updating
    const updateData: Prisma.DoctorScheduleSlotUncheckedUpdateInput = {
      ...updateDto,
      date: updateDto.date ? new Date(updateDto.date) : undefined,
    };

    const updatedSlot = await this.bookingRepository.updateScheduleSlot(
      id,
      updateData,
    );

    return updatedSlot;
  }

  async remove(id: string) {
    await this.findById(id);

    const deletedSlot = await this.bookingRepository.updateScheduleSlot(id, {
      isActive: false,
    });

    return deletedSlot;
  }

  async restore(id: string) {
    await this.findById(id);
    const restoredSlot = await this.bookingRepository.updateScheduleSlot(id, {
      isActive: true,
    });

    return restoredSlot;
  }
}
