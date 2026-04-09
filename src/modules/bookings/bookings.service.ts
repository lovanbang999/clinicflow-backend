import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  BookingStatus,
  BookingSource,
  BookingPriority,
  UserRole,
  DayOfWeek,
  Prisma,
  InvoiceStatus,
} from '@prisma/client';
import {
  BookingInclude,
  BookingWithRelations,
} from '../database/types/prisma-payload.types';
import { Injectable, Inject } from '@nestjs/common';
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
import {
  IProfileRepository,
  I_PROFILE_REPOSITORY,
} from '../database/interfaces/profile.repository.interface';

// Reusable select for patientProfile in booking includes
const patientProfileSelect = {
  id: true,
  userId: true, // Needed for in-app notifications
  fullName: true,
  phone: true,
  email: true,
  isGuest: true,
  patientCode: true,
};

@Injectable()
export class BookingsService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly notificationsService: NotificationsService,
    private readonly queueGateway: QueueGateway,
    private readonly queueService: QueueService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Create a new pre-booking (by patient online)
   * startTime is REQUIRED for pre-bookings.
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

    if (!startTime) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_TIME,
        'startTime is required for pre-bookings',
        400,
        'Booking creation failed',
      );
    }

    // Online booking requires serviceId
    if (!serviceId) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'serviceId is required for online bookings',
        400,
        'Booking creation failed',
      );
    }

    await this.validateBooking({ ...createBookingDto, isPreBooked: true });

    const service = await this.catalogRepository.findServiceById(serviceId);

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

    const booking = await this.bookingRepository.transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          patientProfileId,
          doctorId,
          serviceId: serviceId,
          bookingCode,
          bookingDate: new Date(bookingDate),
          startTime,
          endTime,
          isPreBooked: true,
          status: BookingStatus.PENDING,
          source,
          priority,
          patientNotes,
          bookedBy: null,
        },
        include: BookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.PENDING,
          changedById: createdById,
          reason: 'Pre-booking created online',
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

    // Notify admins of new booking
    await this.notificationsService.notifyAdmins({
      title: 'Lịch hẹn mới',
      content: `${booking.patientProfile.fullName} vừa đặt khám ${booking.service?.name ?? 'Dịch vụ chưa xác định'}.`,
      metadata: { bookingId: booking.id },
    });

    return ResponseHelper.success(
      booking,
      MessageCodes.BOOKING_CREATED,
      'Booking created successfully',
      201,
    );
  }

  /**
   * Create a booking by receptionist/admin.
   * Supports two modes:
   *   - Pre-booking (isPreBooked=true): specific slot is reserved, startTime required.
   *   - Walk-in (isPreBooked=false): patient joins queue, no fixed time needed.
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
      isPreBooked = false, // Default: walk-in for receptionist
    } = createBookingDto;

    await this.validateBooking(createBookingDto);

    // Service is optional for walk-in consultations — Dotor consulation will be determined after meeting the patient
    let service: Prisma.ServiceGetPayload<{
      include: { category: true };
    }> | null = null;
    if (serviceId) {
      service = await this.catalogRepository.findServiceById(serviceId);
      if (!service) {
        throw new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Booking creation failed',
        );
      }
    }

    let endTime: string | undefined;

    // Fetch doctor's schedule slot for the day to get room assignment and capacity
    const slot = await this.bookingRepository.findDoctorScheduleSlot(
      doctorId,
      new Date(bookingDate),
    );

    if (isPreBooked) {
      // Mô hình A: Pre-booking requires startTime, but serviceId is optional
      // (Bác sĩ tư vấn sẽ xác định dịch vụ chuyên khoa sau khi gặp bệnh nhân)
      if (!startTime) {
        throw new ApiException(
          MessageCodes.BOOKING_INVALID_TIME,
          'startTime is required for pre-bookings',
          400,
          'Booking creation failed',
        );
      }
      // Calculate endTime only if service is already known
      if (service) {
        endTime = this.calculateEndTime(startTime, service.durationMinutes);
      }
    } else {
      // Walk-in: verify queue capacity for this doctor+date
      const walkInCount = await this.bookingRepository.countBookingsByFilters({
        doctorId,
        bookingDate: new Date(bookingDate),
        isPreBooked: false,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      });

      const maxQueue = slot?.maxQueueSize ?? 10;
      if (walkInCount >= maxQueue) {
        throw new ApiException(
          MessageCodes.QUEUE_SLOT_FULL,
          `Walk-in queue is full for this doctor today (max ${maxQueue})`,
          409,
          'Booking creation failed',
        );
      }
    }

    const bookingCode = await this.generateBookingCode(bookingDate);

    const booking = (await this.bookingRepository.transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          patientProfileId,
          doctorId,
          serviceId: serviceId || undefined,
          bookingCode,
          bookingDate: new Date(bookingDate),
          startTime: isPreBooked ? startTime : undefined,
          endTime: isPreBooked ? endTime : undefined,
          isPreBooked,
          status: BookingStatus.CONFIRMED,
          source,
          priority,
          patientNotes,
          bookedBy: createdById,
          confirmedAt: new Date(),
          roomId: slot?.roomId || undefined,
        },
        include: BookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.CONFIRMED,
          changedById: createdById,
          reason: isPreBooked
            ? 'Pre-booking created by receptionist'
            : 'Walk-in booking created by receptionist',
        },
      });

      return newBooking;
    })) as unknown as BookingWithRelations;

    this.sendBookingNotification(booking).catch((error) => {
      console.error('Failed to send booking notification:', error);
    });

    // Auto-create invoice — chỉ khi serviceId đã xác định
    if (serviceId) {
      try {
        await this.billingService.createInvoice({
          bookingId: booking.id,
          notes: isPreBooked
            ? 'Receptionist pre-booking invoice'
            : 'Walk-in generated invoice',
        });
      } catch (e) {
        console.error('Failed to auto-create invoice:', e);
      }
    }

    // Notify admins of new booking (by staff)
    const serviceName = service?.name ?? 'Chưa xác định dịch vụ';
    await this.notificationsService.notifyAdmins({
      title: 'Lịch hẹn mới (từ nhân viên)',
      content: `${booking.patientProfile.fullName} được đặt khám ${serviceName}.`,
      metadata: { bookingId: booking.id },
    });

    return ResponseHelper.success(
      booking,
      MessageCodes.BOOKING_CREATED,
      isPreBooked
        ? 'Pre-booking created and confirmed successfully'
        : 'Walk-in booking created successfully',
      201,
    );
  }

  /**
   * B2 — Mô hình A: BS tư vấn xác định dịch vụ chuyên khoa sau khi hỏi thăm bệnh nhân.
   * Triggers auto-create of CONSULTATION invoice.
   */
  async updateService(
    bookingId: string,
    serviceId: string,
    doctorId: string,
    newDoctorId?: string,
  ) {
    const booking = await this.bookingRepository.findBookingById(bookingId);
    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Update service failed',
      );
    }

    // Only the assigned doctor or admin can set the service
    if (booking.doctorId !== doctorId) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Only the assigned doctor can update the service',
        403,
        'Update service failed',
      );
    }

    if (booking.serviceId) {
      throw new ApiException(
        'BOOKING.SERVICE_ALREADY_SET',
        'Service has already been set for this booking',
        409,
        'Update service failed',
      );
    }

    const service = await this.catalogRepository.findServiceById(serviceId);
    if (!service || !service.isActive) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'Service not found or inactive',
        404,
        'Update service failed',
      );
    }

    // 1. Remove from current consultation queue (since consultation is over)
    await this.queueService.removeFromQueue(bookingId);

    // 2. Update booking: assign service, maybe new doctor, and move back to CONFIRMED
    const updated = await this.bookingRepository.update({
      where: { id: bookingId },
      data: {
        serviceId,
        doctorId: newDoctorId ?? booking.doctorId,
        status: BookingStatus.CONFIRMED,
        checkedInAt: null, // Reset check-in timestamp so receptionist can check-in for the new service
      },
    });

    // 3. Create status history tracking
    await this.bookingRepository.transaction(async (tx) => {
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: booking.status,
          newStatus: BookingStatus.CONFIRMED,
          changedById: doctorId,
          reason:
            'Service assigned by consultation doctor. Moved to payment stage.',
        },
      });
    });

    // 4. Auto-create specialization invoice
    try {
      await this.billingService.createInvoice({
        bookingId,
        notes: `Specialized service: ${service.name} — assigned by doctor`,
      });
    } catch (e) {
      console.error('Failed to auto-create specialized invoice:', e);
    }

    // 5. Notify receptionists
    await this.notificationsService.notifyReceptionists({
      title: 'Chờ thanh toán & Khám chuyên khoa',
      content: `Bệnh nhân ${booking.patientProfile.fullName} đã hoàn tất tư vấn. Cần thanh toán dịch vụ: ${service.name}.`,
      metadata: { bookingId, serviceId, type: 'PAYMENT_REQUIRED' },
    });

    return ResponseHelper.success(
      updated,
      'BOOKING.SERVICE_UPDATED',
      'Booking service and specialist updated successfully. Patient referred to reception.',
    );
  }

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
        { bookingCode: { contains: search } },
        {
          patientProfile: {
            fullName: { contains: search },
          },
        },
        {
          patientProfile: {
            patientCode: { contains: search },
          },
        },
        {
          patientProfile: { phone: { contains: search } },
        },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.bookingRepository.findMany({
        where,
        include: {
          ...BookingInclude,
          queueRecord: true,
          medicalRecord: {
            include: {
              prescription: {
                include: {
                  items: true,
                },
              },
              labOrders: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.bookingRepository.count({ where }),
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
    const booking = await this.bookingRepository.findUnique({
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
        medicalRecord: {
          include: {
            prescription: {
              include: {
                items: true,
              },
            },
            labOrders: true,
          },
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

    const updatedBooking = await this.bookingRepository.transaction(
      async (tx) => {
        const updated = await tx.booking.update({
          where: { id },
          data: {
            status,
            doctorNotes: doctorNotes || booking.doctorNotes,
            ...extraData,
          },
          include: BookingInclude,
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
            startTime: booking.startTime ?? '',
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
      },
    );

    if (status === BookingStatus.CANCELLED) {
      this.sendCancellationNotification(updatedBooking).catch((error) => {
        console.error('Failed to send cancellation notification:', error);
      });
    }

    if (status === BookingStatus.CONFIRMED) {
      const email = updatedBooking.patientProfile?.email;
      if (email) {
        this.notificationsService
          .sendBookingConfirmation({
            bookingId: updatedBooking.bookingCode ?? updatedBooking.id,
            patientId: updatedBooking.patientProfile.userId ?? undefined,
            patientName: updatedBooking.patientProfile.fullName,
            patientEmail: email,
            doctorName: updatedBooking.doctor.fullName,
            serviceName:
              updatedBooking.service?.name ?? 'Tư vấn (Chưa xác định)',
            bookingDate: format(
              new Date(updatedBooking.bookingDate),
              'EEEE, dd/MM/yyyy',
              { locale: vi },
            ),
            startTime: updatedBooking.startTime ?? '',
            endTime: updatedBooking.endTime ?? '',
            duration: updatedBooking.service?.durationMinutes ?? 0,
            status: updatedBooking.status,
          })
          .catch((error) => {
            console.error('Failed to send confirmation notification:', error);
          });
      }
    }

    // Notify admins of status change
    const statusLabels: Record<string, string> = {
      CONFIRMED: 'đã xác nhận',
      CHECKED_IN: 'đã check-in',
      COMPLETED: 'đã hoàn thành',
      CANCELLED: 'đã hủy',
    };
    if (statusLabels[status]) {
      await this.notificationsService.notifyAdmins({
        title: 'Cập nhật lịch hẹn',
        content: `Lịch hẹn của ${updatedBooking.patientProfile.fullName} ${statusLabels[status]}.`,
        metadata: { bookingId: updatedBooking.id, status: status },
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

    const booking = result.data;
    if (!booking) return result;

    // Notify admins of cancellation
    await this.notificationsService.notifyAdmins({
      title: 'Lịch hẹn đã hủy',
      content: `Lịch hẹn của ${booking.patientProfile.fullName} đã bị hủy.`,
      metadata: { bookingId: id },
    });

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
    const booking = await this.bookingRepository.findUnique({
      where: { id },
      select: { doctorId: true },
    });

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Start examination failed',
      );
    }

    // Single Active Patient Rule: Check if doctor already has an active examination
    const activeExam = await this.bookingRepository.findFirst({
      where: {
        doctorId: booking.doctorId,
        status: BookingStatus.IN_PROGRESS,
        medicalRecord: null, // Medical record block is only generated upon Save Draft or Complete
      },
    });

    if (activeExam) {
      throw new ApiException(
        MessageCodes.BOOKING_DOCTOR_BUSY,
        'Bác sĩ đang khám cho một bệnh nhân khác. Vui lòng lưu nháp hoặc hoàn tất phiên khám hiện tại trước khi gọi bệnh nhân tiếp theo.',
        400,
        'Start examination failed',
      );
    }

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
    const profile = await this.profileRepository.findFirstPatientProfile({
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
      this.bookingRepository.findMany({
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
      this.bookingRepository.count({ where }),
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
    const profile = await this.profileRepository.findFirstPatientProfile({
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
      this.bookingRepository.count({
        where: {
          patientProfileId,
          status: BookingStatus.CONFIRMED,
          bookingDate: { gte: today },
        },
      }),
      this.bookingRepository.count({
        where: { patientProfileId, status: BookingStatus.COMPLETED },
      }),
      this.bookingRepository.count({
        where: { patientProfileId, status: BookingStatus.CHECKED_IN },
      }),
      this.bookingRepository.count({ where: { patientProfileId } }),
    ]);

    const nextBooking = await this.bookingRepository.findFirst({
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
   * Get unique patients who have had completed visits with this doctor.
   * Supports pagination and search by name / patient code / phone.
   */
  async getMyPatients(
    doctorId: string,
    options: { search?: string; page?: number; limit?: number },
  ) {
    const { search, page = 1, limit = 10 } = options;

    const patientWhere: Prisma.PatientProfileWhereInput = {};
    if (search) {
      patientWhere.OR = [
        { fullName: { contains: search } },
        { patientCode: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // Get distinct patientProfileIds that have at least one COMPLETED booking with this doctor
    const completedPatientIds = await this.bookingRepository.findMany({
      where: {
        doctorId,
        status: BookingStatus.COMPLETED,
        patientProfile: search ? patientWhere : undefined,
      },
      select: { patientProfileId: true },
      distinct: ['patientProfileId'],
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { bookingDate: 'desc' },
    });

    const totalDistinct = await this.bookingRepository.findMany({
      where: {
        doctorId,
        status: BookingStatus.COMPLETED,
        patientProfile: search ? patientWhere : undefined,
      },
      select: { patientProfileId: true },
      distinct: ['patientProfileId'],
    });

    const ids = completedPatientIds.map((b) => b.patientProfileId);

    // For each patient, fetch profile + stats
    const patients = await Promise.all(
      ids.map(async (patientProfileId) => {
        const profile = await this.profileRepository.findUniquePatientProfile({
          where: { id: patientProfileId },
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
            bloodType: true,
            allergies: true,
          },
        });

        const [totalVisits, lastVisitRecord] = await Promise.all([
          this.bookingRepository.count({
            where: {
              doctorId,
              patientProfileId,
              status: BookingStatus.COMPLETED,
            },
          }),
          this.bookingRepository.findFirst({
            where: {
              doctorId,
              patientProfileId,
              status: BookingStatus.COMPLETED,
            },
            orderBy: { bookingDate: 'desc' },
            select: { bookingDate: true, service: { select: { name: true } } },
          }),
        ]);

        return {
          ...profile,
          totalVisits,
          lastVisitDate: lastVisitRecord?.bookingDate ?? null,
          lastServiceName: lastVisitRecord?.service?.name ?? null,
        };
      }),
    );

    return ResponseHelper.success(
      {
        patients,
        pagination: {
          total: totalDistinct.length,
          page,
          limit,
          totalPages: Math.ceil(totalDistinct.length / limit),
        },
      },
      MessageCodes.BOOKING_LIST_RETRIEVED,
      'My patients retrieved successfully',
      200,
    );
  }

  async checkIn(bookingId: string, userId: string) {
    return this.queueService.addToQueue(bookingId, userId);
  }

  /**
   * Recalculate estimatedTime for all walk-in patients of a doctor on a given date.
   * Called after each check-in to keep estimated times accurate.
   */
  async recalculateEstimatedTimes(
    doctorId: string,
    bookingDate: string,
  ): Promise<void> {
    // Fetch all pre-bookings still active today (to find gaps)
    const preBookings = await this.bookingRepository.findMany({
      where: {
        doctorId,
        bookingDate: new Date(bookingDate),
        isPreBooked: true,
        startTime: { not: null },
        status: {
          notIn: [
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW,
            BookingStatus.COMPLETED,
          ],
        },
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    // Fetch walk-in queue records for this doctor today
    const walkInQueues = await this.bookingRepository.findQueueMany({
      where: {
        doctorId,
        queueDate: new Date(bookingDate),
        isPreBooked: false,
        booking: {
          status: {
            notIn: [
              BookingStatus.CANCELLED,
              BookingStatus.NO_SHOW,
              BookingStatus.COMPLETED,
            ],
          },
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            service: { select: { durationMinutes: true } },
          },
        },
      },
      orderBy: { queuePosition: 'asc' },
    });

    if (walkInQueues.length === 0) return;

    // Find available gaps between pre-bookings or use end-of-day
    // Simple strategy: stack walk-ins starting from last pre-booking end time
    const now = new Date();
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const lastPreEnd = preBookings.at(-1)?.endTime ?? nowTimeStr;

    let cursor = new Date(bookingDate);
    const [hh, mm] = lastPreEnd.split(':').map(Number);
    cursor.setHours(hh, mm, 0, 0);

    for (const record of walkInQueues) {
      const estTime = new Date(cursor);
      const duration = record.booking.service?.durationMinutes ?? 30;

      await this.bookingRepository.update({
        where: { id: record.booking.id },
        data: { estimatedTime: estTime },
      });

      cursor = new Date(cursor.getTime() + duration * 60 * 1000);
    }
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
      this.bookingRepository.count({
        where: { ...todayWhere, status: BookingStatus.PENDING },
      }),
      this.bookingRepository.count({
        where: { ...todayWhere, status: BookingStatus.CONFIRMED },
      }),
      this.bookingRepository.count({
        where: { ...todayWhere, status: BookingStatus.COMPLETED },
      }),
      this.bookingRepository.count({
        where: { ...todayWhere, status: BookingStatus.CANCELLED },
      }),
      // Yesterday
      this.bookingRepository.count({
        where: { ...yesterdayWhere, status: BookingStatus.PENDING },
      }),
      this.bookingRepository.count({
        where: { ...yesterdayWhere, status: BookingStatus.CONFIRMED },
      }),
      this.bookingRepository.count({
        where: { ...yesterdayWhere, status: BookingStatus.COMPLETED },
      }),
      this.bookingRepository.count({
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
   * Validate booking data.
   * Rules:
   *   - Date must be today or future
   *   - Patient, doctor, service must exist and be active
   *   - Doctor must work on the requested day
   *   - startTime must be within working hours (pre-booking only)
   *   - 1 patient + 1 doctor + 1 date = max 1 active booking
   */
  private async validateBooking(dto: CreateBookingDto) {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      bookingDate,
      startTime,
      isPreBooked = true,
    } = dto;

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

    // 4. Check service exists and is active (only if provided - Model A support)
    if (serviceId) {
      const service = await this.catalogRepository.findUnique({
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

      // Break time check skipped — DoctorBreakTime is managed separately via schedules service
    }

    // Off day check skipped — DoctorOffDay is managed separately via schedules service

    // 8. Rule: 1 patient + 1 doctor + 1 date = max 1 active booking
    // Enforced purely at the application level since MySQL doesn't support partial unique indexes
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
   * Generate a human-readable booking code: BK-YYYYMMDD-NNNN (Production-ready)
   */
  private async generateBookingCode(bookingDate: string): Promise<string> {
    const compact = bookingDate.replace(/-/g, '');
    const prefix = `BK-${compact}-`;

    // Find the latest booking code for this prefix to avoid collisions after deletions
    const lastBooking = await this.bookingRepository.findFirst({
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
    const confirmedBookings = await this.bookingRepository.count({
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
        patientId: booking.patientProfile.userId ?? undefined,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime ?? '',
        endTime: booking.endTime ?? '',
        duration: booking.service?.durationMinutes ?? 0,
        status: booking.status,
        price: booking.service?.price
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
        patientId: booking.patientProfile.userId ?? undefined,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime ?? '',
        endTime: booking.endTime ?? '',
        duration: booking.service?.durationMinutes ?? 0,
        status: booking.status,
        price: booking.service?.price
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
