import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { CreateBreakTimeDto } from './dto/create-break-time.dto';
import { CreateOffDayDto } from './dto/create-off-day.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { DayOfWeek, BookingStatus, Prisma } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update working hours for a doctor
   */
  async createWorkingHours(dto: CreateWorkingHoursDto) {
    const { doctorId, dayOfWeek, startTime, endTime } = dto;

    // Validate doctor exists
    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Working hours creation failed',
      );
    }

    // Validate time format
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check if working hours already exist
    const existing = await this.prisma.doctorWorkingHours.findUnique({
      where: {
        doctorId_dayOfWeek: {
          doctorId,
          dayOfWeek,
        },
      },
    });

    let workingHours;

    if (existing) {
      // Update existing
      workingHours = await this.prisma.doctorWorkingHours.update({
        where: {
          doctorId_dayOfWeek: {
            doctorId,
            dayOfWeek,
          },
        },
        data: {
          startTime,
          endTime,
        },
      });
    } else {
      // Create new
      workingHours = await this.prisma.doctorWorkingHours.create({
        data: {
          doctorId,
          dayOfWeek,
          startTime,
          endTime,
        },
      });
    }

    return ResponseHelper.success(
      workingHours,
      MessageCodes.SCHEDULE_CREATED,
      'Working hours saved successfully',
      201,
    );
  }

  /**
   * Get all working hours for a doctor
   */
  async getWorkingHours(doctorId: string) {
    const workingHours = await this.prisma.doctorWorkingHours.findMany({
      where: { doctorId },
      orderBy: {
        dayOfWeek: 'asc',
      },
    });

    return ResponseHelper.success(
      workingHours,
      MessageCodes.SCHEDULE_LIST_RETRIEVED,
      'Working hours retrieved successfully',
      200,
    );
  }

  /**
   * Delete working hours
   */
  async deleteWorkingHours(doctorId: string, dayOfWeek: DayOfWeek) {
    const workingHours = await this.prisma.doctorWorkingHours.findUnique({
      where: {
        doctorId_dayOfWeek: {
          doctorId,
          dayOfWeek,
        },
      },
    });

    if (!workingHours) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Working hours not found',
        404,
        'Deletion failed',
      );
    }

    await this.prisma.doctorWorkingHours.delete({
      where: {
        doctorId_dayOfWeek: {
          doctorId,
          dayOfWeek,
        },
      },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.SCHEDULE_DELETED,
      'Working hours deleted successfully',
      200,
    );
  }

  /**
   * Create break time for a doctor
   */
  async createBreakTime(dto: CreateBreakTimeDto) {
    const { doctorId, date, startTime, endTime, reason } = dto;

    // Validate doctor exists
    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Break time creation failed',
      );
    }

    // Validate time
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const breakDate = new Date(date);

    if (breakDate < today) {
      throw new BadRequestException('Cannot create break time for past dates');
    }

    // Create break time
    const breakTime = await this.prisma.doctorBreakTime.create({
      data: {
        doctorId,
        date: new Date(date),
        startTime,
        endTime,
        reason,
      },
    });

    return ResponseHelper.success(
      breakTime,
      MessageCodes.SCHEDULE_CREATED,
      'Break time created successfully',
      201,
    );
  }

  /**
   * Get all break times for a doctor
   */
  async getBreakTimes(doctorId: string, startDate?: string, endDate?: string) {
    const where: Prisma.DoctorBreakTimeWhereInput = { doctorId };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = {
        gte: new Date(startDate),
      };
    }

    const breakTimes = await this.prisma.doctorBreakTime.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return ResponseHelper.success(
      breakTimes,
      MessageCodes.SCHEDULE_LIST_RETRIEVED,
      'Break times retrieved successfully',
      200,
    );
  }

  /**
   * Delete break time
   */
  async deleteBreakTime(id: string) {
    const breakTime = await this.prisma.doctorBreakTime.findUnique({
      where: { id },
    });

    if (!breakTime) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Break time not found',
        404,
        'Deletion failed',
      );
    }

    await this.prisma.doctorBreakTime.delete({
      where: { id },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.SCHEDULE_DELETED,
      'Break time deleted successfully',
      200,
    );
  }

  /**
   * Create off day for a doctor
   */
  async createOffDay(dto: CreateOffDayDto) {
    const { doctorId, date, reason } = dto;

    // Validate doctor exists
    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Off day creation failed',
      );
    }

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offDate = new Date(date);

    if (offDate < today) {
      throw new BadRequestException('Cannot create off day for past dates');
    }

    // Check if off day already exists
    const existing = await this.prisma.doctorOffDay.findUnique({
      where: {
        doctorId_date: {
          doctorId,
          date: new Date(date),
        },
      },
    });

    if (existing) {
      throw new ApiException(
        MessageCodes.SCHEDULE_CONFLICT,
        'Off day already exists for this date',
        409,
        'Off day creation failed',
      );
    }

    // Create off day
    const offDay = await this.prisma.doctorOffDay.create({
      data: {
        doctorId,
        date: new Date(date),
        reason,
      },
    });

    return ResponseHelper.success(
      offDay,
      MessageCodes.SCHEDULE_CREATED,
      'Off day created successfully',
      201,
    );
  }

  /**
   * Get all off days for a doctor
   */
  async getOffDays(doctorId: string, startDate?: string, endDate?: string) {
    const where: Prisma.DoctorOffDayWhereInput = { doctorId };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = {
        gte: new Date(startDate),
      };
    }

    const offDays = await this.prisma.doctorOffDay.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return ResponseHelper.success(
      offDays,
      MessageCodes.SCHEDULE_LIST_RETRIEVED,
      'Off days retrieved successfully',
      200,
    );
  }

  /**
   * Delete off day
   */
  async deleteOffDay(doctorId: string, date: string) {
    const offDay = await this.prisma.doctorOffDay.findUnique({
      where: {
        doctorId_date: {
          doctorId,
          date: new Date(date),
        },
      },
    });

    if (!offDay) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Off day not found',
        404,
        'Deletion failed',
      );
    }

    await this.prisma.doctorOffDay.delete({
      where: {
        doctorId_date: {
          doctorId,
          date: new Date(date),
        },
      },
    });

    return ResponseHelper.success(
      null,
      MessageCodes.SCHEDULE_DELETED,
      'Off day deleted successfully',
      200,
    );
  }

  /**
   * Get available time slots for a doctor on a specific date
   */
  async getAvailableSlots(queryDto: AvailableSlotsQueryDto) {
    const { doctorId, date, serviceId } = queryDto;

    // Get service to know duration
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Available slots retrieval failed',
      );
    }

    // Get day of week
    const requestedDate = new Date(date);
    const dayOfWeek = this.getDayOfWeek(requestedDate);

    // Get working hours for this day
    const workingHours = await this.prisma.doctorWorkingHours.findUnique({
      where: {
        doctorId_dayOfWeek: {
          doctorId,
          dayOfWeek,
        },
      },
    });

    if (!workingHours) {
      return ResponseHelper.success(
        {
          availableSlots: [],
          message: 'Doctor does not work on this day',
        },
        MessageCodes.AVAILABLE_SLOTS_RETRIEVED,
        'No available slots',
        200,
      );
    }

    // Check if date is an off day
    const offDay = await this.prisma.doctorOffDay.findUnique({
      where: {
        doctorId_date: {
          doctorId,
          date: new Date(date),
        },
      },
    });

    if (offDay) {
      return ResponseHelper.success(
        {
          availableSlots: [],
          message: `Doctor is not available: ${offDay.reason || 'Off day'}`,
        },
        MessageCodes.AVAILABLE_SLOTS_RETRIEVED,
        'No available slots',
        200,
      );
    }

    // Get break times for this date
    const breakTimes = await this.prisma.doctorBreakTime.findMany({
      where: {
        doctorId,
        date: new Date(date),
      },
    });

    // Generate all possible slots
    const allSlots = this.generateTimeSlots(
      workingHours.startTime,
      workingHours.endTime,
      service.durationMinutes,
    );

    // Filter out slots that conflict with break times
    const slotsAfterBreaks = allSlots.filter((slot) => {
      return !breakTimes.some((breakTime) => {
        return this.isTimeConflict(
          slot,
          service.durationMinutes,
          breakTime.startTime,
          breakTime.endTime,
        );
      });
    });

    // Check availability for each slot
    const availableSlots = await this.filterAvailableSlots(
      slotsAfterBreaks,
      doctorId,
      date,
      service.maxSlotsPerHour,
      queryDto.patientId,
    );

    return ResponseHelper.success(
      {
        availableSlots,
        total: availableSlots.length,
      },
      MessageCodes.AVAILABLE_SLOTS_RETRIEVED,
      'Available slots retrieved successfully',
      200,
    );
  }

  // PRIVATE HELPER METHODS

  /**
   * Generate time slots based on working hours and service duration
   */
  private generateTimeSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
  ): string[] {
    const slots: string[] = [];
    let currentMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    while (currentMinutes + durationMinutes <= endMinutes) {
      slots.push(this.minutesToTime(currentMinutes));
      currentMinutes += 30; // Move by 30-minute intervals
    }

    return slots;
  }

  /**
   * Check if a time slot conflicts with a break time
   */
  private isTimeConflict(
    slotTime: string,
    slotDuration: number,
    breakStart: string,
    breakEnd: string,
  ): boolean {
    const slotStartMinutes = this.timeToMinutes(slotTime);
    const slotEndMinutes = slotStartMinutes + slotDuration;
    const breakStartMinutes = this.timeToMinutes(breakStart);
    const breakEndMinutes = this.timeToMinutes(breakEnd);

    return (
      slotStartMinutes < breakEndMinutes && slotEndMinutes > breakStartMinutes
    );
  }

  /**
   * Filter slots by checking booking availability
   */
  private async filterAvailableSlots(
    slots: string[],
    doctorId: string,
    date: string,
    maxSlotsPerHour: number,
    patientId?: string,
  ): Promise<string[]> {
    const availableSlots: string[] = [];

    // Get all active bookings for this doctor on this date
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        doctorId,
        bookingDate: new Date(date),
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
          ],
        },
      },
      include: {
        service: {
          select: {
            durationMinutes: true,
          },
        },
      },
    });

    // Get patient's existing bookings for this date if patientId is provided
    const patientBookings = patientId
      ? existingBookings.filter((booking) => booking.patientId === patientId)
      : [];

    for (const slot of slots) {
      // Check if patient already has a booking at this slot
      const patientHasBooking = patientBookings.some(
        (booking) => booking.startTime === slot,
      );

      // Skip this slot if patient already booked it
      if (patientHasBooking) {
        continue;
      }

      // Count bookings that start at this exact slot time
      const exactMatchCount = existingBookings.filter(
        (booking) => booking.startTime === slot,
      ).length;

      // Only add slot if it hasn't reached maximum capacity
      if (exactMatchCount < maxSlotsPerHour) {
        availableSlots.push(slot);
      }
    }

    return availableSlots;
  }

  /**
   * Get day of week from date
   */
  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }

  /**
   * Convert time string to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes to time string
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
