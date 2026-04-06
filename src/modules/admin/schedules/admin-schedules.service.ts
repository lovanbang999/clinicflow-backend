import { Injectable, Inject } from '@nestjs/common';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../../database/interfaces/booking.repository.interface';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../../database/interfaces/user.repository.interface';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import { Prisma, ScheduleSlotStatus } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { ApiException } from '../../../common/exceptions/api.exception';

@Injectable()
export class AdminSchedulesService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async getStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [totalAppointments, todaysSlots, canceledBookings] =
      await Promise.all([
        this.bookingRepository.count({}),
        this.bookingRepository.countDoctorScheduleSlot({
          where: {
            date: {
              gte: today,
              lte: endOfToday,
            },
          },
        }),
        this.bookingRepository.countBooking({
          where: {
            status: 'CANCELLED',
            bookingDate: {
              gte: today,
              lte: endOfToday,
            },
          },
        }),
      ]);

    // Calculate a mock avg waiting time based on booking queue
    const queuedBookings = await this.bookingRepository.aggregateQueue({
      _avg: {
        estimatedWaitMinutes: true,
      },
    });

    return ResponseHelper.success(
      {
        totalAppointments,
        todaysSlots,
        canceledToday: canceledBookings,
        avgWaitTime: Math.round(queuedBookings._avg?.estimatedWaitMinutes ?? 0),
      },
      MessageCodes.SCHEDULE_STATISTICS_RETRIEVED,
      'Schedule statistics retrieved successfully',
      200,
    );
  }

  async findAll(filters: FilterScheduleDto) {
    const where: Prisma.DoctorScheduleSlotWhereInput = {};

    if (filters.doctorId) {
      where.doctorId = filters.doctorId;
    }
    if (filters.status) {
      where.status = filters.status.toUpperCase() as ScheduleSlotStatus;
    } else if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const slots = await this.bookingRepository.findManyDoctorScheduleSlot({
      where,
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            doctorProfile: {
              select: { specialties: true },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return ResponseHelper.success(
      {
        data: slots,
        meta: {
          total: slots.length,
        },
      },
      MessageCodes.SCHEDULE_LIST_RETRIEVED,
      'Schedules retrieved successfully',
      200,
    );
  }

  private async findById(id: string) {
    const slot = await this.bookingRepository.findUniqueDoctorScheduleSlot({
      where: { id },
      include: {
        doctor: {
          select: { fullName: true },
        },
      },
    });

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

    return ResponseHelper.success(
      slot,
      MessageCodes.SCHEDULE_RETRIEVED,
      'Schedule slot retrieved successfully',
      200,
    );
  }

  async create(createDto: CreateScheduleDto) {
    const doctor = await this.userRepository.findFirst({
      where: { id: createDto.doctorId, role: 'DOCTOR' },
    });
    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Schedule creation failed',
      );
    }

    const newSlot = await this.bookingRepository.createDoctorScheduleSlot({
      data: {
        ...createDto,
        date: new Date(createDto.date),
      },
    });

    return ResponseHelper.success(
      newSlot,
      MessageCodes.SCHEDULE_CREATED,
      'Schedule slot created successfully',
      201,
    );
  }

  async update(id: string, updateDto: UpdateScheduleDto) {
    await this.findById(id); // Check exists

    // Format date string to Date object if updating
    const updateData: Prisma.DoctorScheduleSlotUpdateInput = { ...updateDto };
    if (updateDto.date) {
      updateData.date = new Date(updateDto.date);
    }

    const updatedSlot = await this.bookingRepository.updateDoctorScheduleSlot({
      where: { id },
      data: updateData,
    });

    return ResponseHelper.success(
      updatedSlot,
      MessageCodes.SCHEDULE_UPDATED,
      'Schedule slot updated successfully',
      200,
    );
  }

  async remove(id: string) {
    await this.findById(id);

    const deletedSlot = await this.bookingRepository.updateDoctorScheduleSlot({
      where: { id },
      data: { isActive: false },
    });

    return ResponseHelper.success(
      deletedSlot,
      MessageCodes.SCHEDULE_DELETED,
      'Schedule slot deleted successfully',
      200,
    );
  }

  async restore(id: string) {
    await this.findById(id);
    const restoredSlot = await this.bookingRepository.updateDoctorScheduleSlot({
      where: { id },
      data: { isActive: true },
    });

    return ResponseHelper.success(
      restoredSlot,
      MessageCodes.SCHEDULE_RESTORED,
      'Schedule slot restored successfully',
      200,
    );
  }
}
