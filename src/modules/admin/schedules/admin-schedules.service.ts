import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import { Prisma } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class AdminSchedulesService {
  constructor(private prisma: PrismaService) {}

  async getStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [totalAppointments, todaysSlots, canceledBookings] =
      await Promise.all([
        this.prisma.booking.count(),
        this.prisma.doctorScheduleSlot.count({
          where: {
            date: {
              gte: today,
              lte: endOfToday,
            },
          },
        }),
        this.prisma.booking.count({
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
    const queuedBookings = await this.prisma.bookingQueue.aggregate({
      _avg: {
        estimatedWaitMinutes: true,
      },
    });

    return ResponseHelper.success(
      {
        totalAppointments,
        todaysSlots,
        canceledToday: canceledBookings,
        avgWaitTime: Math.round(queuedBookings._avg.estimatedWaitMinutes || 0),
      },
      'ADMIN.SCHEDULES.STATISTICS',
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
      if (filters.status === 'canceled') {
        where.isActive = false;
      } else {
        where.status = filters.status.toUpperCase();
        where.isActive = true;
      }
    } else if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const slots = await this.prisma.doctorScheduleSlot.findMany({
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
      'ADMIN.SCHEDULES.LIST',
      'Schedules retrieved successfully',
      200,
    );
  }

  async findOne(id: string) {
    const slot = await this.prisma.doctorScheduleSlot.findUnique({
      where: { id },
      include: {
        doctor: {
          select: { fullName: true },
        },
      },
    });

    if (!slot) {
      throw new NotFoundException('Schedule slot not found');
    }

    return ResponseHelper.success(
      slot,
      'ADMIN.SCHEDULES.DETAIL',
      'Schedule slot retrieved successfully',
      200,
    );
  }

  async create(createDto: CreateScheduleDto) {
    const doctor = await this.prisma.user.findFirst({
      where: { id: createDto.doctorId, role: 'DOCTOR' },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const newSlot = await this.prisma.doctorScheduleSlot.create({
      data: {
        ...createDto,
        date: new Date(createDto.date),
      },
    });

    return ResponseHelper.success(
      newSlot,
      'ADMIN.SCHEDULES.CREATE',
      'Schedule slot created successfully',
      201,
    );
  }

  async update(id: string, updateDto: UpdateScheduleDto) {
    await this.findOne(id); // Check exists

    // Format date string to Date object if updating
    const updateData: Prisma.DoctorScheduleSlotUpdateInput = { ...updateDto };
    if (updateDto.date) {
      updateData.date = new Date(updateDto.date);
    }

    const updatedSlot = await this.prisma.doctorScheduleSlot.update({
      where: { id },
      data: updateData,
    });

    return ResponseHelper.success(
      updatedSlot,
      'ADMIN.SCHEDULES.UPDATE',
      'Schedule slot updated successfully',
      200,
    );
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete mechanism by marking inactive, or hard delete. Let's hard delete for simplicity or soft delete if required.
    // I will soft delete:
    const deletedSlot = await this.prisma.doctorScheduleSlot.update({
      where: { id },
      data: { isActive: false },
    });

    return ResponseHelper.success(
      deletedSlot,
      'ADMIN.SCHEDULES.DELETE',
      'Schedule slot deleted successfully',
      200,
    );
  }

  async restore(id: string) {
    await this.findOne(id);
    const restoredSlot = await this.prisma.doctorScheduleSlot.update({
      where: { id },
      data: { isActive: true },
    });

    return ResponseHelper.success(
      restoredSlot,
      'ADMIN.SCHEDULES.RESTORE',
      'Schedule slot restored successfully',
      200,
    );
  }
}
