import {
  BookingStatus,
  BookingSource,
  BookingPriority,
  UserRole,
  DayOfWeek,
  Prisma,
  InvoiceStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { QueueGateway } from '../queue/queue.gateway';
import { QueueService } from '../queue/queue.service';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { ApiException } from 'src/common/exceptions/api.exception';
import { ResponseHelper } from 'src/common/interfaces/api-response.interface';
import { BillingService } from '../billing/billing.service';

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
    private readonly queueGateway: QueueGateway,
    private readonly queueService: QueueService,
    private readonly billingService: BillingService,
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

    // Auto-create invoice
    try {
      await this.billingService.createInvoice({ bookingId: booking.id });
    } catch (e) {
      console.error('Failed to auto-create invoice:', e);
    }

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

    // Auto-create invoice
    try {
      await this.billingService.createInvoice({
        bookingId: booking.id,
        notes: 'Walk-in/Receptionist generated invoice',
      });
    } catch (e) {
      console.error('Failed to auto-create invoice:', e);
    }

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
      search,
      page = 1,
      limit = 10,
    } = filterDto;

    const where: Prisma.BookingWhereInput = {};

    if (patientProfileId) where.patientProfileId = patientProfileId;
    if (doctorId) where.doctorId = doctorId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (date) where.bookingDate = new Date(date);

    if (search) {
      where.OR = [
        { bookingCode: { contains: search, mode: 'insensitive' } },
        {
          patientProfile: {
            fullName: { contains: search, mode: 'insensitive' },
          },
        },
        {
          patientProfile: { phone: { contains: search, mode: 'insensitive' } },
        },
      ];
    }

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
        status === BookingStatus.COMPLETED ||
        status === BookingStatus.NO_SHOW
      ) {
        await this.handleBookingCompletion({
          id: booking.id,
          doctorId: booking.doctor.id,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
        });

        // Auto-update Invoice status if applicable
        if (status === BookingStatus.COMPLETED) {
          await tx.invoice.updateMany({
            where: {
              bookingId: id,
              status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.OPEN] },
            },
            data: { status: InvoiceStatus.ISSUED },
          });
        } else if (
          status === BookingStatus.CANCELLED ||
          status === BookingStatus.NO_SHOW
        ) {
          await tx.invoice.updateMany({
            where: {
              bookingId: id,
              status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.OPEN] },
            },
            data: { status: InvoiceStatus.CANCELLED },
          });
        }
      }

      // If examination starts, broadcast real-time update
      if (status === BookingStatus.IN_PROGRESS) {
        this.queueGateway.broadcastQueueUpdate(updated.doctorId, 'UPDATE', {
          booking: updated,
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
   * Start examination (Move from CHECKED_IN to IN_PROGRESS)
   */
  async startExamination(id: string, userId: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.IN_PROGRESS,
        reason: 'Examination started by doctor',
      },
      userId,
    );
  }

  /**
   * Complete visit (Move from IN_PROGRESS to COMPLETED)
   */
  async completeVisit(id: string, userId: string, doctorNotes?: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.COMPLETED,
        reason: 'Consultation finished',
        doctorNotes,
      },
      userId,
    );
  }

  /**
   * Mark as no-show (Move from CHECKED_IN to NO_SHOW)
   */
  async markNoShow(id: string, userId: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.NO_SHOW,
        reason: 'Patient did not arrive within 30 minutes of check-in',
      },
      userId,
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
   * Check in a patient for their appointment
   */
  async checkIn(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        patientProfile: true,
      },
    });

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Check-in failed',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_STATUS,
        'Only confirmed bookings can be checked in',
        400,
        'Check-in failed',
      );
    }

    // Check if it already has a queue record
    const existingQueue = await this.prisma.bookingQueue.findUnique({
      where: { bookingId },
    });

    if (existingQueue) {
      throw new ApiException(
        MessageCodes.BOOKING_ALREADY_IN_QUEUE,
        'Booking is already in the queue',
        409,
        'Check-in failed',
      );
    }

    // Find the latest queue position for the doctor on that date
    const latestQueue = await this.prisma.bookingQueue.findFirst({
      where: {
        doctorId: booking.doctorId,
        queueDate: booking.bookingDate,
      },
      orderBy: {
        queuePosition: 'desc',
      },
      select: {
        queuePosition: true,
      },
    });

    const currentPosition = latestQueue ? latestQueue.queuePosition + 1 : 1;

    // Estimate wait time (naive estimate: active queue size * 30 min)
    const checkedInCount = await this.prisma.bookingQueue.count({
      where: {
        doctorId: booking.doctorId,
        queueDate: booking.bookingDate,
        booking: { status: BookingStatus.CHECKED_IN },
      },
    });

    // Fallback naive heuristic 30 mins per appointment currently checked-in
    const estWaitMinutes = checkedInCount * 30;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update Booking status
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
      });

      // 2. Create history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: BookingStatus.CONFIRMED,
          newStatus: BookingStatus.CHECKED_IN,
          changedById: userId,
          reason: 'Patient checked in at reception',
        },
      });

      // 3. Create Queue Record
      const queueRecord = await tx.bookingQueue.create({
        data: {
          bookingId,
          doctorId: booking.doctorId,
          queueDate: booking.bookingDate,
          queuePosition: currentPosition,
          estimatedWaitMinutes: estWaitMinutes,
        },
      });

      return { booking: updatedBooking, queue: queueRecord };
    });

    // Broadcast the real-time Queue assignment
    this.queueGateway.broadcastQueueUpdate(
      booking.doctorId,
      'CHECK_IN',
      result,
    );

    return ResponseHelper.success(
      result,
      MessageCodes.BOOKING_UPDATED,
      'Patient successfully checked in',
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
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Doctor does not work on this day',
        400,
        'Booking validation failed',
      );
    }

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
      throw new ApiException(
        MessageCodes.SCHEDULE_CONFLICT,
        `Time slot conflicts with doctor's break time (${breakTime.startTime} - ${breakTime.endTime})`,
        400,
        'Booking validation failed',
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
      throw new ApiException(
        MessageCodes.SCHEDULE_NOT_FOUND,
        'Doctor is not available on this day',
        400,
        'Booking validation failed',
      );
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
   * Handle booking completion (Remove from queue)
   */
  private async handleBookingCompletion(booking: {
    id: string;
    doctorId: string;
    bookingDate: Date;
    startTime: string;
  }): Promise<void> {
    console.log(
      `Booking ${booking.id} completed/cancelled/no-show. Removing from queue...`,
    );

    // Call QueueService to handle record deletion and shift queue positions
    await this.queueService.removeFromQueue(booking.id);

    // Broadcast update so the board refreshes
    this.queueGateway.broadcastQueueUpdate(booking.doctorId, 'UPDATE', {
      bookingId: booking.id,
      status: 'REMOVED',
    });
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
