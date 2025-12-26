import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { BookingStatus, UserRole, DayOfWeek, Prisma } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException('Service not found');
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

    // Step 4: Determine initial status (CONFIRMED or QUEUED)
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

    return {
      ...booking,
      message:
        initialStatus === BookingStatus.QUEUED
          ? 'Booking added to queue. You will be notified when a slot becomes available.'
          : 'Booking created successfully.',
    };
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

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
      throw new NotFoundException('Booking not found');
    }

    return booking;
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

    const booking = await this.findOne(id);

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
          patient: true,
          doctor: true,
          service: true,
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
        this.handleBookingCompletion(booking);
      }

      return updated;
    });

    return updatedBooking;
  }

  /**
   * Cancel booking
   */
  async cancel(id: string, userId: string, reason?: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.CANCELLED,
        reason: reason || 'Cancelled by user',
      },
      userId,
    );
  }

  /**
   * Delete booking (soft delete - actually just cancel)
   */
  async remove(id: string, userId: string) {
    return this.cancel(id, userId, 'Booking deleted');
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
      throw new BadRequestException(
        'Booking date must be today or in the future',
      );
    }

    // 2. Check patient exists
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (patient.role !== UserRole.PATIENT) {
      throw new BadRequestException('User is not a patient');
    }

    // 3. Check doctor exists and is active
    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
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
      throw new NotFoundException('Service not found or inactive');
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
      throw new ConflictException(
        'You already have a booking with this doctor on this date',
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
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Handle booking completion (for queue promotion)
   */
  private handleBookingCompletion(booking: { id: string }) {
    // This will be enhanced when we implement queue module
    // For now, just a placeholder
    console.log(
      `Booking ${booking.id} completed/cancelled. Check queue for promotion.`,
    );
  }
}
