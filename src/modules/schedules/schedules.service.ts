import {
  Injectable,
  Inject,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { BulkUpdateWorkingHoursDto } from './dto/bulk-update-working-hours.dto';
import { CreateBreakTimeDto } from './dto/create-break-time.dto';
import { CreateOffDayDto } from './dto/create-off-day.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { DayOfWeek, UserRole } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../database/interfaces/booking.repository.interface';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../database/interfaces/user.repository.interface';
import {
  ICatalogRepository,
  I_CATALOG_REPOSITORY,
} from '../database/interfaces/catalog.repository.interface';

@Injectable()
export class SchedulesService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  /**
   * Create or update working hours for a doctor
   */
  async createWorkingHours(dto: CreateWorkingHoursDto) {
    const { doctorId, dayOfWeek, startTime, endTime } = dto;

    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Working hours creation failed',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const existing = await this.bookingRepository.findDoctorWorkingHours(
      doctorId,
      dayOfWeek,
    );

    let workingHours;
    if (existing) {
      workingHours = await this.bookingRepository.updateDoctorWorkingHours(
        doctorId,
        dayOfWeek,
        { startTime, endTime },
      );
    } else {
      workingHours = await this.bookingRepository.createDoctorWorkingHours({
        doctor: { connect: { id: doctorId } },
        dayOfWeek,
        startTime,
        endTime,
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
    const workingHours =
      await this.bookingRepository.findWorkingHoursList(doctorId);

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
    const workingHours = await this.bookingRepository.findDoctorWorkingHours(
      doctorId,
      dayOfWeek,
    );

    if (!workingHours) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Working hours not found',
        404,
        'Deletion failed',
      );
    }

    await this.bookingRepository.deleteDoctorWorkingHours(doctorId, dayOfWeek);

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

    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Break time creation failed',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const breakDate = new Date(date);

    if (breakDate < today) {
      throw new BadRequestException('Cannot create break time for past dates');
    }

    const breakTime = await this.bookingRepository.createDoctorBreakTime({
      data: { doctorId, breakDate: new Date(date), startTime, endTime, reason },
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
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const breakTimes = await this.bookingRepository.findDoctorBreakTimes(
      doctorId,
      start,
      end,
    );

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
    // Ideally check existence, but keeping logic consistent
    await this.bookingRepository.deleteDoctorBreakTime(id).catch(() => {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Break time not found',
        404,
        'Deletion failed',
      );
    });

    return ResponseHelper.success(
      null,
      MessageCodes.SCHEDULE_DELETED,
      'Break time deleted successfully',
      200,
    );
  }

  /**
   * Preview an off day
   */
  async previewOffDay(doctorId: string, date: string) {
    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Preview failed',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offDate = new Date(date);
    if (offDate < today) {
      throw new BadRequestException('Cannot preview off day for past dates');
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setHours(23, 59, 59, 999);

    const affectedAppointments =
      await this.bookingRepository.findAffectedBookingsForDateRange(
        doctorId,
        dateStart,
        dateEnd,
      );

    return ResponseHelper.success(
      {
        affectedAppointments: affectedAppointments.map((b) => ({
          id: b.id,
          patientName: b.patientProfile?.fullName ?? 'Unknown',
          patientPhone: b.patientProfile?.phone ?? '',
          serviceName: b.service?.name ?? '',
          startTime: b.startTime,
          status: b.status,
        })),
      },
      MessageCodes.SCHEDULE_LIST_RETRIEVED,
      'Preview retrieved successfully',
      200,
    );
  }

  /**
   * Create off day for a doctor
   */
  async createOffDay(dto: CreateOffDayDto) {
    const { doctorId, date, reason } = dto;

    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Off day creation failed',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offDate = new Date(date);

    if (offDate < today) {
      throw new BadRequestException('Cannot create off day for past dates');
    }

    const existing = await this.bookingRepository.findDoctorOffDay(
      doctorId,
      new Date(date),
    );
    if (existing) {
      throw new ApiException(
        MessageCodes.SCHEDULE_CONFLICT,
        'Off day already exists for this date',
        409,
        'Off day creation failed',
      );
    }

    const offDateObj = new Date(date);
    offDateObj.setHours(0, 0, 0, 0);
    const offDateEnd = new Date(offDateObj);
    offDateEnd.setHours(23, 59, 59, 999);

    const affectedAppointments =
      await this.bookingRepository.findAffectedBookingsForDateRange(
        doctorId,
        offDateObj,
        offDateEnd,
      );

    const offDay = await this.bookingRepository.createDoctorOffDayTransaction(
      {
        doctor: { connect: { id: doctorId } },
        offDate: new Date(date),
        reason,
      },
      dto.cancelAffected ?? false,
      affectedAppointments.map((b) => b.id),
    );

    return ResponseHelper.success(
      {
        id: offDay.id,
        doctorId: offDay.doctorId,
        date: offDay.offDate.toISOString().split('T')[0],
        reason: offDay.reason,
        affectedAppointments: affectedAppointments.map((b) => ({
          id: b.id,
          patientName: b.patientProfile?.fullName ?? 'Unknown',
          patientPhone: b.patientProfile?.phone ?? '',
          serviceName: b.service?.name ?? '',
          startTime: b.startTime,
          status: b.status,
        })),
        cancelledCount: dto.cancelAffected ? affectedAppointments.length : 0,
      },
      MessageCodes.SCHEDULE_CREATED,
      'Off day created successfully',
      201,
    );
  }

  /**
   * Get all off days for a doctor
   */
  async getOffDays(doctorId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const offDays = await this.bookingRepository.findDoctorOffDays(
      doctorId,
      start,
      end,
    );

    return ResponseHelper.success(
      offDays.map((od) => ({
        id: od.id,
        doctorId: od.doctorId,
        date: od.offDate.toISOString().split('T')[0],
        reason: od.reason,
      })),
      MessageCodes.SCHEDULE_LIST_RETRIEVED,
      'Off days retrieved successfully',
      200,
    );
  }

  /**
   * Delete off day
   */
  async deleteOffDay(doctorId: string, date: string) {
    const offDay = await this.bookingRepository.findDoctorOffDay(
      doctorId,
      new Date(date),
    );

    if (!offDay) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Off day not found',
        404,
        'Deletion failed',
      );
    }

    await this.bookingRepository.deleteDoctorOffDay(doctorId, new Date(date));

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

    const service = await this.catalogRepository.findServiceById(serviceId);
    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Available slots retrieval failed',
      );
    }

    const requestedDate = new Date(date);
    const dayOfWeek = this.getDayOfWeek(requestedDate);

    const workingHours = await this.bookingRepository.findDoctorWorkingHours(
      doctorId,
      dayOfWeek,
    );

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

    const offDay = await this.bookingRepository.findDoctorOffDay(
      doctorId,
      new Date(date),
    );

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

    const breakTimes = await this.bookingRepository.findDoctorBreakTimes(
      doctorId,
      new Date(date),
      new Date(date),
    );

    const allSlots = this.generateTimeSlots(
      workingHours.startTime,
      workingHours.endTime,
      service.durationMinutes,
    );

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

  private async filterAvailableSlots(
    slots: string[],
    doctorId: string,
    date: string,
    maxSlotsPerHour: number,
    patientId?: string,
  ): Promise<string[]> {
    const availableSlots: string[] = [];

    const existingBookings =
      await this.bookingRepository.findBookingsByDoctorAndDate(
        doctorId,
        new Date(date),
      );

    const patientBookings = patientId
      ? existingBookings.filter(
          (booking) => booking.patientProfileId === patientId,
        )
      : [];

    for (const slot of slots) {
      const patientHasBooking = patientBookings.some(
        (booking) => booking.startTime === slot,
      );

      if (patientHasBooking) {
        continue;
      }

      const exactMatchCount = existingBookings.filter(
        (booking) => booking.startTime === slot,
      ).length;

      if (exactMatchCount < maxSlotsPerHour) {
        availableSlots.push(slot);
      }
    }

    return availableSlots;
  }

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

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  async bulkUpdateWorkingHours(dto: BulkUpdateWorkingHoursDto) {
    const { doctorId, items } = dto;

    const doctor = await this.userRepository.findById(doctorId);
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        HttpStatus.NOT_FOUND,
      );
    }

    for (const item of items) {
      if (item.enabled && item.startTime >= item.endTime) {
        throw new BadRequestException(
          `Start time must be before end time for ${item.dayOfWeek}`,
        );
      }
    }

    const updatedList =
      await this.bookingRepository.bulkUpdateDoctorWorkingHoursTransaction(
        doctorId,
        items,
      );

    return ResponseHelper.success(
      updatedList,
      MessageCodes.SCHEDULE_CREATED,
      'Bulk working hours updated successfully',
      200,
    );
  }
}
