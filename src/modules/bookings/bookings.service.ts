import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { BookingStatus, UserRole, DayOfWeek, Prisma } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';

// Type for booking with relations
interface BookingWithRelations {
  id: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  patientNotes: string | null;
  patient: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
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

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new booking
   */
  async create(createBookingDto: CreateBookingDto, createdById: string) {
    const {
      patientId,
      doctorId,
      serviceId,
      bookingDate,
      startTime,
      patientNotes,
    } = createBookingDto;

    // Step 1: Validate booking
    await this.validateBooking(createBookingDto);

    // Step 2: Get service to calculate end time
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

    // Step 3: Check slot availability
    const isSlotAvailable = await this.checkSlotAvailability(
      doctorId,
      bookingDate,
      startTime,
      endTime,
      service.maxSlotsPerHour,
    );

    // Step 4: Determine initial status (PENDING or QUEUED)
    const initialStatus = isSlotAvailable
      ? BookingStatus.PENDING
      : BookingStatus.QUEUED;

    // Step 5: Create booking with transaction
    const booking = await this.prisma.$transaction(async (tx) => {
      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          patientId,
          doctorId,
          serviceId,
          bookingDate: new Date(bookingDate),
          startTime,
          endTime,
          status: initialStatus,
          patientNotes,
        },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
            },
          },
          doctor: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
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

      // Create status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedById: createdById,
          reason: 'Booking created',
        },
      });

      // If queued, create queue record
      if (initialStatus === BookingStatus.QUEUED) {
        const queuePosition = await this.calculateQueuePosition(
          tx,
          doctorId,
          bookingDate,
          startTime,
        );

        await tx.bookingQueue.create({
          data: {
            bookingId: newBooking.id,
            queuePosition,
            estimatedWaitMinutes: queuePosition * service.durationMinutes,
          },
        });
      }

      return newBooking;
    });

    const message =
      initialStatus === BookingStatus.QUEUED
        ? 'Booking added to queue. You will be notified when a slot becomes available.'
        : 'Booking created successfully';

    // Send booking confirmation email (non-blocking)
    this.sendBookingNotification(booking).catch((error) => {
      console.error('Failed to send booking notification:', error);
    });

    return ResponseHelper.success(
      booking,
      MessageCodes.BOOKING_CREATED,
      message,
      201,
    );
  }

  /**
   * Find all bookings with filters
   */
  async findAll(filterDto: FilterBookingDto) {
    const {
      patientId,
      doctorId,
      serviceId,
      status,
      date,
      page = 1,
      limit = 10,
    } = filterDto;

    // Build where clause with proper typing
    const where: Prisma.BookingWhereInput = {};

    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (date) where.bookingDate = new Date(date);

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          doctor: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
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
        patient: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
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
              select: {
                id: true,
                fullName: true,
                role: true,
              },
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

    // Get booking (will throw if not found)
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

    // Validate status transition
    this.validateStatusTransition(booking.status, status);

    // Update booking in transaction
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      // Update booking
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status,
          doctorNotes: doctorNotes || booking.doctorNotes,
        },
        include: {
          patient: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
            },
          },
          doctor: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
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

      // Create status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          oldStatus: booking.status,
          newStatus: status,
          changedById,
          reason,
        },
      });

      // If cancelled or completed, check queue for promotion
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

    // Send notification for cancellation (non-blocking)
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
   * Delete booking (soft delete - actually just cancel)
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
   * Get patient dashboard statistics
   */
  async getPatientDashboardStats(patientId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      upcomingBookings,
      completedBookings,
      waitingBookings,
      totalBookings,
    ] = await Promise.all([
      // Upcoming bookings (confirmed, not yet today)
      this.prisma.booking.count({
        where: {
          patientId,
          status: BookingStatus.CONFIRMED,
          bookingDate: {
            gte: today,
          },
        },
      }),
      // Completed bookings
      this.prisma.booking.count({
        where: {
          patientId,
          status: BookingStatus.COMPLETED,
        },
      }),
      // Waiting in queue
      this.prisma.booking.count({
        where: {
          patientId,
          status: {
            in: [BookingStatus.QUEUED, BookingStatus.CHECKED_IN],
          },
        },
      }),
      // Total bookings
      this.prisma.booking.count({
        where: {
          patientId,
        },
      }),
    ]);

    // Get next upcoming booking
    const nextBooking = await this.prisma.booking.findFirst({
      where: {
        patientId,
        status: BookingStatus.CONFIRMED,
        bookingDate: {
          gte: today,
        },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
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

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Validate booking data
   */
  private async validateBooking(dto: CreateBookingDto) {
    const { patientId, doctorId, serviceId, bookingDate, startTime } = dto;

    // 1. Check booking date is in the future
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

    // 2. Check patient exists
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Patient not found',
        404,
        'Booking validation failed',
      );
    }

    if (patient.role !== UserRole.PATIENT) {
      throw new BadRequestException('User is not a patient');
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

    // 4. Check service exists
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
      where: {
        doctorId_dayOfWeek: {
          doctorId,
          dayOfWeek,
        },
      },
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
        date: new Date(bookingDate),
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
        doctorId_date: {
          doctorId,
          date: new Date(bookingDate),
        },
      },
    });

    if (offDay) {
      throw new BadRequestException('Doctor is not available on this day');
    }

    // 8. Check duplicate booking (same patient, same doctor, same day)
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        patientId,
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
        'You already have a booking with this doctor on this date',
        409,
        'Booking validation failed',
      );
    }
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
   * Calculate queue position
   */
  private async calculateQueuePosition(
    tx: Prisma.TransactionClient,
    doctorId: string,
    bookingDate: string,
    startTime: string,
  ): Promise<number> {
    const queueCount = await tx.bookingQueue.count({
      where: {
        booking: {
          doctorId,
          bookingDate: new Date(bookingDate),
          startTime,
        },
      },
    });

    return queueCount + 1;
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
      [BookingStatus.QUEUED]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
      ],
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
   * Handle booking completion (for queue promotion)
   * Remove async since no await is used currently
   */
  private handleBookingCompletion(booking: {
    id: string;
    doctorId: string;
    bookingDate: Date;
    startTime: string;
  }): void {
    // This will be enhanced when we integrate queue module
    // For now, just a placeholder
    console.log(
      `Booking ${booking.id} completed/cancelled. Check queue for promotion.`,
    );
    // TODO: Call queueService.autoPromote(booking.doctorId, booking.bookingDate, booking.startTime)
  }

  /**
   * Send booking notification email
   */
  private async sendBookingNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      await this.notificationsService.sendBookingConfirmation({
        bookingId: booking.id,
        patientName: booking.patient.fullName,
        patientEmail: booking.patient.email,
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
   * Send cancellation notification email
   */
  private async sendCancellationNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      await this.notificationsService.sendBookingCancellation({
        bookingId: booking.id,
        patientName: booking.patient.fullName,
        patientEmail: booking.patient.email,
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
