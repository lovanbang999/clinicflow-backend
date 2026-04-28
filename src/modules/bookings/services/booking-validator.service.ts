import { Injectable, Inject } from '@nestjs/common';
import { BookingStatus, UserRole, DayOfWeek } from '@prisma/client';
import { SlotReservation } from '../../database/types/prisma-payload.types';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { ApiException } from 'src/common/exceptions/api.exception';
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
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../../database/interfaces/profile.repository.interface';

@Injectable()
export class BookingValidatorService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  /**
   * Validate booking data.
   */
  async validateBooking(dto: CreateBookingDto) {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      bookingDate,
      startTime,
      isPreBooked = true,
    } = dto;

    // 1. Check booking date is today or in the future
    const getVnDate = (date: Date) => {
      return new Date(
        date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
      );
    };

    const today = getVnDate(new Date());
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(bookingDate);

    if (requestedDate < today) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_DATE,
        'Booking date must be today or in the future',
        400,
        'Booking validation failed',
      );
    }

    // Check time if requested date is today
    if (startTime && requestedDate.getTime() === today.getTime()) {
      const vnNow = getVnDate(new Date());
      const currentHhMm = `${String(vnNow.getHours()).padStart(2, '0')}:${String(
        vnNow.getMinutes(),
      ).padStart(2, '0')}`;

      if (startTime < currentHhMm) {
        throw new ApiException(
          MessageCodes.BOOKING_INVALID_DATE,
          'Booking time must be in the future for today',
          400,
          'Booking validation failed',
        );
      }
    }

    // 2. Check patientProfile exists
    const patientProfile = await this.profileRepository.findFirstPatientProfile(
      {
        where: { id: patientProfileId },
      },
    );

    if (!patientProfile) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Patient profile not found',
        404,
        'Booking validation failed',
      );
    }

    // 3. Check doctor exists and is active
    const doctor = await this.userRepository.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Booking validation failed',
      );
    }

    if (doctor.role !== UserRole.DOCTOR) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User is not a doctor',
        400,
        'Booking validation failed',
      );
    }

    if (!doctor.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_INACTIVE,
        'Doctor is not active',
        400,
        'Booking validation failed',
      );
    }

    // 4. Check service exists and is active
    if (serviceId) {
      const service = await this.catalogRepository.findServiceById(serviceId);

      if (!service || !service.isActive) {
        throw new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found or inactive',
          404,
          'Booking validation failed',
        );
      }
    }

    // 5. Check doctor working hours
    const dayOfWeek = this.getDayOfWeek(new Date(bookingDate));
    const workingHours = await this.bookingRepository.findDoctorWorkingHours(
      doctorId,
      dayOfWeek,
    );

    if (!workingHours) {
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Doctor does not work on this day',
        400,
        'Booking validation failed',
      );
    }

    // 6. startTime validation (only for pre-bookings)
    if (isPreBooked && startTime) {
      if (
        startTime < workingHours.startTime ||
        startTime >= workingHours.endTime
      ) {
        throw new ApiException(
          MessageCodes.BOOKING_INVALID_TIME,
          `Time slot is outside doctor's working hours (${workingHours.startTime} - ${workingHours.endTime})`,
          400,
          'Booking validation failed',
        );
      }
    }

    // 8. Rule: 1 patient + 1 doctor + 1 date = max 1 active booking
    const existingBooking = await this.bookingRepository.findFirst({
      where: {
        patientProfileId,
        doctorId,
        bookingDate: new Date(bookingDate),
        status: {
          notIn: [
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW,
            BookingStatus.COMPLETED,
          ],
        },
      },
    });

    if (existingBooking) {
      throw new ApiException(
        MessageCodes.BOOKING_DUPLICATE,
        'This patient already has an active booking with this doctor on this date',
        409,
        'Booking validation failed',
      );
    }
  }

  /**
   * Check if slot is available
   */
  async checkSlotAvailability(
    doctorId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    maxSlotsPerHour: number,
    patientProfileId?: string,
  ): Promise<boolean> {
    const [confirmedBookings, reservations] = await Promise.all([
      this.bookingRepository.count({
        where: {
          doctorId,
          bookingDate: new Date(bookingDate),
          startTime,
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
              BookingStatus.IN_PROGRESS,
              BookingStatus.AWAITING_RESULTS,
            ],
          },
        },
      }),
      this.bookingRepository.findSlotReservations(
        doctorId,
        new Date(bookingDate),
      ),
    ]);

    // Exclude current patient's reservation from count
    const otherReservationsCount = reservations.filter(
      (r: SlotReservation) =>
        r.startTime === startTime && r.patientProfileId !== patientProfileId,
    ).length;

    return confirmedBookings + otherReservationsCount < maxSlotsPerHour;
  }

  /**
   * Calculate end time based on duration
   */
  calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  /**
   * Get day of week from date
   */
  getDayOfWeek(date: Date): DayOfWeek {
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
   * Validate status transition
   */
  validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus,
  ) {
    const validTransitions: Record<string, BookingStatus[]> = {
      [BookingStatus.PENDING]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CHECKED_IN,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
      ],
      [BookingStatus.CHECKED_IN]: [
        BookingStatus.IN_PROGRESS,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.IN_PROGRESS]: [
        BookingStatus.AWAITING_RESULTS, // Patient goes to lab after doctor orders tests
        BookingStatus.COMPLETED, // Doctor finishes without ordering tests
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.AWAITING_RESULTS]: [
        BookingStatus.IN_PROGRESS, // Patient returns to doctor after lab results are ready
        BookingStatus.COMPLETED, // Doctor completes visit after reviewing results
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NO_SHOW]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_STATUS_TRANSITION,
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400,
        'Status update failed',
      );
    }
  }
}
