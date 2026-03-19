import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import {
  BookingStatus,
  BookingSource,
  BookingPriority,
  UserRole,
  DayOfWeek,
  Prisma,
} from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

interface BookingWithRelations {
  id: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  patientNotes: string | null;
  patientProfile: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    isGuest: boolean;
    patientCode: string;
  };
  doctor: {
    id: string;
    email: string;
    fullName: string;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    price: Prisma.Decimal;
  };
}

// Reusable select for patientProfile in booking includes
const patientProfileSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  isGuest: true,
  patientCode: true,
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new booking (by patient online)
   */
  async create(createBookingDto: CreateBookingDto, createdById: string) {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      bookingDate,
      startTime,
      patientNotes,
      source = BookingSource.ONLINE,
      priority = BookingPriority.NORMAL,
    } = createBookingDto;

    await this.validateBooking(createBookingDto);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Booking creation failed',
      );
    }

    const endTime = this.calculateEndTime(startTime, service.durationMinutes);

    void (await this.checkSlotAvailability(
      doctorId,
      bookingDate,
      startTime,
      endTime,
      service.maxSlotsPerHour,
    ));

    const bookingCode = await this.generateBookingCode(bookingDate);

    const booking = await this.prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          patientProfileId,
          doctorId,
          serviceId,
          bookingCode,
          bookingDate: new Date(bookingDate),
          startTime,
          endTime,
          status: BookingStatus.PENDING,
          source,
          priority,
          patientNotes,
          bookedBy: null,
        },
        include: {
          patientProfile: { select: patientProfileSelect },
          doctor: { select: { id: true, email: true, fullName: true } },
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
            },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.PENDING,
          changedById: createdById,
          reason: 'Booking created online',
        },
      });

      return newBooking;
    });

    this.sendBookingNotification(booking).catch((error) => {
      console.error('Failed to send booking notification:', error);
    });

    return ResponseHelper.success(
      booking,
      MessageCodes.BOOKING_CREATED,
      'Booking created successfully',
      201,
    );
  }

  /**
   * Create a booking by receptionist/admin (Auto CONFIRMED, source = WALK_IN or RECEPTIONIST)
   */
  async createByReceptionist(
    createBookingDto: CreateBookingDto,
    createdById: string,
  ) {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      bookingDate,
      startTime,
      patientNotes,
      source = BookingSource.RECEPTIONIST,
      priority = BookingPriority.NORMAL,
    } = createBookingDto;

    await this.validateBooking(createBookingDto);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found',
        404,
        'Booking creation failed',
      );
    }

    const endTime = this.calculateEndTime(startTime, service.durationMinutes);
    const bookingCode = await this.generateBookingCode(bookingDate);

    const booking = await this.prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          patientProfileId,
          doctorId,
          serviceId,
          bookingCode,
          bookingDate: new Date(bookingDate),
          startTime,
          endTime,
          status: BookingStatus.CONFIRMED,
          source,
          priority,
          patientNotes,
          bookedBy: createdById,
          confirmedAt: new Date(),
        },
        include: {
          patientProfile: { select: patientProfileSelect },
          doctor: { select: { id: true, email: true, fullName: true } },
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
            },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.CONFIRMED,
          changedById: createdById,
          reason: 'Booking created by receptionist',
        },
      });

      return newBooking;
    });

    this.sendBookingNotification(booking).catch((error) => {
      console.error('Failed to send booking notification:', error);
    });

    return ResponseHelper.success(
      booking,
      MessageCodes.BOOKING_CREATED,
      'Booking created and confirmed successfully',
      201,
    );
  }

  /**
   * Find all bookings with filters
   */
  async findAll(filterDto: FilterBookingDto) {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      status,
      date,
      page = 1,
      limit = 10,
    } = filterDto;

    const where: Prisma.BookingWhereInput = {};

    if (patientProfileId) where.patientProfileId = patientProfileId;
    if (doctorId) where.doctorId = doctorId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (date) where.bookingDate = new Date(date);

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          patientProfile: { select: patientProfileSelect },
          doctor: { select: { id: true, fullName: true, email: true } },
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
            },
          },
          queueRecord: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.prisma.booking.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        bookings,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      MessageCodes.BOOKING_LIST_RETRIEVED,
      'Bookings retrieved successfully',
      200,
    );
  }

  /**
   * Find one booking by ID
   */
  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        patientProfile: { select: { ...patientProfileSelect, userId: true } },
        doctor: { select: { id: true, fullName: true, email: true } },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            price: true,
          },
        },
        queueRecord: true,
        statusHistory: {
          include: {
            changedBy: {
              select: { id: true, fullName: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Booking retrieval failed',
      );
    }

    return ResponseHelper.success(
      booking,
      MessageCodes.BOOKING_RETRIEVED,
      'Booking retrieved successfully',
      200,
    );
  }

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateBookingStatusDto,
    changedById: string,
  ) {
    const { status, reason, doctorNotes } = updateStatusDto;

    const bookingResponse = await this.findOne(id);
    const booking = bookingResponse.data;

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Status update failed',
      );
    }

    this.validateStatusTransition(booking.status, status);

    // Build extra timestamps for key transitions
    const extraData: Prisma.BookingUpdateInput = {};
    if (status === BookingStatus.CONFIRMED) extraData.confirmedAt = new Date();
    if (status === BookingStatus.CHECKED_IN) extraData.checkedInAt = new Date();

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status,
          doctorNotes: doctorNotes || booking.doctorNotes,
          ...extraData,
        },
        include: {
          patientProfile: { select: patientProfileSelect },
          doctor: { select: { id: true, email: true, fullName: true } },
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
            },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          oldStatus: booking.status,
          newStatus: status,
          changedById,
          reason,
        },
      });

      if (
        status === BookingStatus.CANCELLED ||
        status === BookingStatus.COMPLETED
      ) {
        this.handleBookingCompletion({
          id: booking.id,
          doctorId: booking.doctor.id,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
        });
      }

      return updated;
    });

    if (status === BookingStatus.CANCELLED) {
      this.sendCancellationNotification(updatedBooking).catch((error) => {
        console.error('Failed to send cancellation notification:', error);
      });
    }

    return ResponseHelper.success(
      updatedBooking,
      MessageCodes.BOOKING_UPDATED,
      'Booking status updated successfully',
      200,
    );
  }

  /**
   * Cancel booking
   */
  async cancel(id: string, userId: string, reason?: string) {
    const result = await this.updateStatus(
      id,
      {
        status: BookingStatus.CANCELLED,
        reason: reason || 'Cancelled by user',
      },
      userId,
    );

    return ResponseHelper.success(
      result.data,
      MessageCodes.BOOKING_CANCELLED,
      'Booking cancelled successfully',
      200,
    );
  }

  /**
   * Delete booking (soft delete — effectively cancel)
   */
  async remove(id: string, userId: string) {
    const result = await this.cancel(id, userId, 'Booking deleted');

    return ResponseHelper.success(
      result.data,
      MessageCodes.BOOKING_DELETED,
      'Booking deleted successfully',
      200,
    );
  }

  /**
   * Get my bookings (for current patient — filter by patientProfile.userId)
   */
  async getMyBookings(
    userId: string,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { status, page = 1, limit = 10 } = options;

    // Find the PatientProfile belonging to this user
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return ResponseHelper.success(
        {
          bookings: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        },
        MessageCodes.BOOKING_LIST_RETRIEVED,
        'My bookings retrieved successfully',
        200,
      );
    }

    const where: Prisma.BookingWhereInput = {
      patientProfileId: profile.id,
    };

    if (status) {
      where.status = status as BookingStatus;
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
              iconUrl: true,
            },
          },
          doctor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true,
            },
          },
          queueRecord: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.prisma.booking.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        bookings,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      MessageCodes.BOOKING_LIST_RETRIEVED,
      'My bookings retrieved successfully',
      200,
    );
  }

  /**
   * Get patient dashboard statistics
   */
  async getPatientDashboardStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the PatientProfile belonging to this user
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return ResponseHelper.success(
        {
          stats: {
            upcomingBookings: 0,
            completedBookings: 0,
            waitingBookings: 0,
            totalBookings: 0,
          },
          nextBooking: null,
        },
        MessageCodes.BOOKING_LIST_RETRIEVED,
        'Dashboard statistics retrieved successfully',
        200,
      );
    }

    const patientProfileId = profile.id;

    const [
      upcomingBookings,
      completedBookings,
      waitingBookings,
      totalBookings,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          patientProfileId,
          status: BookingStatus.CONFIRMED,
          bookingDate: { gte: today },
        },
      }),
      this.prisma.booking.count({
        where: { patientProfileId, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { patientProfileId, status: BookingStatus.CHECKED_IN },
      }),
      this.prisma.booking.count({ where: { patientProfileId } }),
    ]);

    const nextBooking = await this.prisma.booking.findFirst({
      where: {
        patientProfileId,
        status: BookingStatus.CONFIRMED,
        bookingDate: { gte: today },
      },
      include: {
        service: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true, avatar: true } },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });

    return ResponseHelper.success(
      {
        stats: {
          upcomingBookings,
          completedBookings,
          waitingBookings,
          totalBookings,
        },
        nextBooking,
      },
      MessageCodes.BOOKING_LIST_RETRIEVED,
      'Dashboard statistics retrieved successfully',
      200,
    );
  }

  /**
   * Get receptionist dashboard statistics
   */
  async getReceptionistDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayWhere = {
      bookingDate: {
        gte: today,
        lt: nextDay,
      },
    };

    const yesterdayWhere = {
      bookingDate: {
        gte: yesterday,
        lt: today,
      },
    };

    const [
      pendingToday,
      confirmedToday,
      completedToday,
      cancelledToday,
      pendingYesterday,
      confirmedYesterday,
      completedYesterday,
      cancelledYesterday,
    ] = await Promise.all([
      // Today
      this.prisma.booking.count({
        where: { ...todayWhere, status: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { ...todayWhere, status: BookingStatus.CONFIRMED },
      }),
      this.prisma.booking.count({
        where: { ...todayWhere, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { ...todayWhere, status: BookingStatus.CANCELLED },
      }),
      // Yesterday
      this.prisma.booking.count({
        where: { ...yesterdayWhere, status: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { ...yesterdayWhere, status: BookingStatus.CONFIRMED },
      }),
      this.prisma.booking.count({
        where: { ...yesterdayWhere, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { ...yesterdayWhere, status: BookingStatus.CANCELLED },
      }),
    ]);

    const calcTrend = (t: number, y: number) => {
      if (y === 0) {
        if (t === 0) return { value: t, trend: 0, trendDir: 'neutral' };
        return { value: t, trend: 100, trendDir: 'up' };
      }
      const diff = t - y;
      const percentage = Math.round((Math.abs(diff) / y) * 100);

      if (diff > 0) return { value: t, trend: percentage, trendDir: 'up' };
      if (diff < 0) return { value: t, trend: percentage, trendDir: 'down' };
      return { value: t, trend: 0, trendDir: 'neutral' };
    };

    return ResponseHelper.success(
      {
        pending: calcTrend(pendingToday, pendingYesterday),
        confirmed: calcTrend(confirmedToday, confirmedYesterday),
        completed: calcTrend(completedToday, completedYesterday),
        cancelled: calcTrend(cancelledToday, cancelledYesterday),
      },
      MessageCodes.BOOKING_LIST_RETRIEVED,
      'Receptionist dashboard statistics retrieved successfully',
      200,
    );
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Validate booking data
   */
  private async validateBooking(dto: CreateBookingDto) {
    const { patientProfileId, doctorId, serviceId, bookingDate, startTime } =
      dto;

    // 1. Check booking date is today or in the future
    const today = new Date();
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

    // 2. Check patientProfile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
    });

    if (!patientProfile) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Patient profile not found',
        404,
        'Booking validation failed',
      );
    }

    // 3. Check doctor exists and is active
    const doctor = await this.prisma.user.findUnique({
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
      throw new BadRequestException('User is not a doctor');
    }

    if (!doctor.isActive) {
      throw new BadRequestException('Doctor is not active');
    }

    // 4. Check service exists and is active
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service || !service.isActive) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found or inactive',
        404,
        'Booking validation failed',
      );
    }

    // 5. Check doctor working hours
    const dayOfWeek = this.getDayOfWeek(new Date(bookingDate));
    const workingHours = await this.prisma.doctorWorkingHours.findUnique({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
    });

    if (!workingHours) {
      throw new BadRequestException('Doctor does not work on this day');
    }

    if (
      startTime < workingHours.startTime ||
      startTime >= workingHours.endTime
    ) {
      throw new BadRequestException(
        `Time slot is outside doctor's working hours (${workingHours.startTime} - ${workingHours.endTime})`,
      );
    }

    // 6. Check for break times
    const breakTime = await this.prisma.doctorBreakTime.findFirst({
      where: {
        doctorId,
        breakDate: new Date(bookingDate),
        AND: [
          { startTime: { lte: startTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    if (breakTime) {
      throw new BadRequestException(
        `Time slot conflicts with doctor's break time (${breakTime.startTime} - ${breakTime.endTime})`,
      );
    }

    // 7. Check for off days
    const offDay = await this.prisma.doctorOffDay.findUnique({
      where: {
        doctorId_offDate: {
          doctorId,
          offDate: new Date(bookingDate),
        },
      },
    });

    if (offDay) {
      throw new BadRequestException('Doctor is not available on this day');
    }

    // 8. Check duplicate booking (same patient profile + doctor + same day)
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        patientProfileId,
        doctorId,
        bookingDate: new Date(bookingDate),
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      },
    });

    if (existingBooking) {
      throw new ApiException(
        MessageCodes.BOOKING_DUPLICATE,
        'This patient already has a booking with this doctor on this date',
        409,
        'Booking validation failed',
      );
    }
  }

  /**
   * Generate a human-readable booking code: BK-YYYYMMDD-NNNN (Production-ready)
   */
  private async generateBookingCode(bookingDate: string): Promise<string> {
    const compact = bookingDate.replace(/-/g, '');
    const prefix = `BK-${compact}-`;

    // Find the latest booking code for this prefix to avoid collisions after deletions
    const lastBooking = await this.prisma.booking.findFirst({
      where: { bookingCode: { startsWith: prefix } },
      orderBy: { bookingCode: 'desc' },
      select: { bookingCode: true },
    });

    let nextNumber = 1;
    if (lastBooking) {
      const parts = lastBooking.bookingCode.split('-');
      const lastNumber = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Check if slot is available
   */
  private async checkSlotAvailability(
    doctorId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    maxSlotsPerHour: number,
  ): Promise<boolean> {
    void endTime; // not used for count check currently
    const confirmedBookings = await this.prisma.booking.count({
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
          ],
        },
      },
    });

    return confirmedBookings < maxSlotsPerHour;
  }

  /**
   * Calculate end time based on duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
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
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus,
  ) {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
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
      [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NO_SHOW]: [],
      [BookingStatus.QUEUED]: [], // deprecated
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

  /**
   * Handle booking completion (queue promotion placeholder)
   */
  private handleBookingCompletion(booking: {
    id: string;
    doctorId: string;
    bookingDate: Date;
    startTime: string;
  }): void {
    console.log(
      `Booking ${booking.id} completed/cancelled. Check queue for promotion.`,
    );
  }

  /**
   * Send booking notification — supports both registered and guest patients
   */
  private async sendBookingNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    // Guest patients may not have email — skip silently if no email available
    const email = booking.patientProfile.email;
    if (!email) return;

    try {
      await this.notificationsService.sendBookingConfirmation({
        bookingId: booking.id,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service.name,
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.service.durationMinutes,
        status: booking.status,
        price: booking.service.price
          ? Number(booking.service.price)
          : undefined,
        patientNotes: booking.patientNotes ?? undefined,
      });
    } catch (error) {
      console.error('Failed to send booking notification:', error);
    }
  }

  /**
   * Send cancellation notification — supports both registered and guest patients
   */
  private async sendCancellationNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    const email = booking.patientProfile.email;
    if (!email) return;

    try {
      await this.notificationsService.sendBookingCancellation({
        bookingId: booking.id,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service.name,
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.service.durationMinutes,
        status: booking.status,
        price: booking.service.price
          ? Number(booking.service.price)
          : undefined,
      });
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
    }
  }

  /**
   * Format date to readable string
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
