import {
  BookingStatus,
  BookingSource,
  BookingPriority,
  UserRole,
  Prisma,
  InvoiceStatus,
  User,
  NotificationType,
  VisitStep,
} from '@prisma/client';
import {
  BookingInclude,
  BookingWithRelations,
} from '../database/types/prisma-payload.types';
import { TransactionClient } from '../database/interfaces/clinical.repository.interface';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { BookingValidatorService } from './services/booking-validator.service';
import { BookingNotificationService } from './services/booking-notification.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { QueueGateway } from '../queue/queue.gateway';
import { QueueService } from '../queue/queue.service';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { ApiException } from 'src/common/exceptions/api.exception';
import {
  ResponseHelper,
  ApiResponse,
} from 'src/common/interfaces/api-response.interface';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
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
import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';

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
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly validator: BookingValidatorService,
    private readonly bookingNotification: BookingNotificationService,
    private readonly queueGateway: QueueGateway,
    private readonly queueService: QueueService,
    private readonly billingService: BillingService,
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    private readonly notificationsService: NotificationsService,
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

    // Online booking validation
    if (source === BookingSource.ONLINE) {
      // serviceId is now optional for online bookings (Consultation path)
    }

    await this.validator.validateBooking({
      ...createBookingDto,
      isPreBooked: true,
    });

    let durationMinutes = 30; // Default: 30 minutes
    let maxSlotsPerHour = 1; // Default

    if (serviceId) {
      const service = await this.catalogRepository.findServiceById(serviceId);
      if (!service) {
        throw new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Booking creation failed',
        );
      }
      durationMinutes = service.durationMinutes;
      maxSlotsPerHour = service.maxSlotsPerHour;
    }

    const endTime = this.validator.calculateEndTime(startTime, durationMinutes);

    const isAvailable = await this.validator.checkSlotAvailability(
      doctorId,
      bookingDate,
      startTime,
      endTime,
      maxSlotsPerHour,
      patientProfileId,
    );

    if (!isAvailable) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_TIME,
        'Time slot is no longer available or is temporarily locked',
        400,
        'Booking validation failed',
      );
    }

    const bookingCode = await this.generateBookingCode(bookingDate);

    const booking = await this.bookingRepository.transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          patientProfileId,
          doctorId,
          serviceId: serviceId || undefined,
          bookingCode,
          bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
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

      // Release reservation if exists
      if (source === BookingSource.ONLINE) {
        await (
          tx as TransactionClient & {
            slotReservation: {
              deleteMany: (args: {
                where: {
                  doctorId: string;
                  bookingDate: Date;
                  startTime: string;
                  patientProfileId: string;
                };
              }) => Promise<Prisma.BatchPayload>;
            };
          }
        ).slotReservation.deleteMany({
          where: {
            doctorId,
            bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
            startTime,
            patientProfileId,
          },
        });
      }

      return newBooking;
    });

    this.bookingNotification.sendBookingNotification(booking).catch((error) => {
      console.error('Failed to send booking notification:', error);
    });

    // Auto-create invoice
    try {
      await this.billingService.createInvoice({ bookingId: booking.id });
    } catch (e) {
      console.error('Failed to auto-create invoice:', e);
    }

    // Notify admins and receptionists of new booking
    await this.bookingNotification.notifyAdminsOfBooking(booking, 'CREATED');
    await this.notificationsService.notifyRole({
      role: UserRole.RECEPTIONIST,
      title: 'Lịch hẹn trực tuyến mới',
      content: `Bệnh nhân ${booking.patientProfile.fullName} vừa đặt lịch khám ${booking.service?.name ?? 'Dịch vụ chưa xác định'} trực tuyến.`,
      type: NotificationType.SYSTEM,
      metadata: { bookingId: booking.id, source: 'ONLINE' },
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

    await this.validator.validateBooking(createBookingDto);

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
      new Date(`${bookingDate}T00:00:00.000Z`),
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
        endTime = this.validator.calculateEndTime(
          startTime,
          service.durationMinutes,
        );
      }
    } else {
      // Walk-in: verify queue capacity for this doctor+date
      const walkInCount = await this.bookingRepository.countBookingsByFilters({
        doctorId,
        bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
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
          bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
          startTime: isPreBooked ? startTime : undefined,
          endTime: isPreBooked ? endTime : undefined,
          isPreBooked,
          status: isPreBooked ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
          source,
          priority,
          patientNotes,
          bookedBy: createdById,
          confirmedAt: isPreBooked ? null : new Date(),
          roomId: slot?.roomId || undefined,
        },
        include: BookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: isPreBooked
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
          changedById: createdById,
          reason: isPreBooked
            ? 'Pre-booking created by receptionist, pending confirmation'
            : 'Walk-in booking created by receptionist, auto-confirmed',
        },
      });

      return newBooking;
    })) as unknown as BookingWithRelations;

    this.bookingNotification.sendBookingNotification(booking).catch((error) => {
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

    await this.bookingNotification.notifyAdminsOfBooking(booking, 'CREATED');

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
   * Mô hình B — "Đặt thẳng dịch vụ" (Mode B Direct Service Walk-in).
   *
   * Bệnh nhân đã biết cần xét nghiệm / chuyên khoa gì.
   * Luồng B3 → B4: KHÔNG tạo CONSULTATION invoice, KHÔNG qua B2 tư vấn.
   *
   * Transaction tạo:
   *  1. Booking (status=CONFIRMED, source=WALK_IN)
   *  2. MedicalRecord (visitStep=SERVICES_ORDERED — bỏ qua SYMPTOMS_TAKEN)
   *  3. LabOrder (TECHNICIAN) hoặc VisitServiceOrder (DOCTOR) cho mỗi service
   *  4. Invoice LAB DRAFT (seeded with all orders)
   */
  async createDirectServiceBooking(
    dto: import('./dto/create-direct-service-booking.dto').CreateDirectServiceBookingDto,
    createdById: string,
  ): Promise<ApiResponse<any>> {
    const {
      patientProfileId,
      doctorId,
      serviceIds,
      bookingDate,
      isPreBooked = false,
      startTime,
      patientNotes,
      priority = BookingPriority.NORMAL,
    } = dto;

    if (isPreBooked && !startTime) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_TIME,
        'startTime is required for pre-bookings',
        400,
        'Direct service booking failed',
      );
    }

    // Validate all services exist and are active
    const services = await this.catalogRepository.findManyServices({
      where: { id: { in: serviceIds }, isActive: true },
      include: {
        doctorServices: {
          include: {
            doctorProfile: { include: { user: { select: { id: true } } } },
          },
          take: 1,
        },
      },
    });

    if (services.length !== serviceIds.length) {
      throw new ApiException(
        MessageCodes.SERVICE_NOT_FOUND,
        'One or more services not found or inactive',
        404,
        'Direct service booking failed',
      );
    }

    // Validate doctor exists and patient profile is valid
    await this.validator.validateBooking({
      patientProfileId,
      doctorId,
      bookingDate,
      isPreBooked,
      // serviceId omitted intentionally — validator handles undefined gracefully
    } as import('./dto/create-booking.dto').CreateBookingDto);

    const slot = await this.bookingRepository.findDoctorScheduleSlot(
      doctorId,
      new Date(`${bookingDate}T00:00:00.000Z`),
    );

    if (!isPreBooked) {
      const walkInCount = await this.bookingRepository.countBookingsByFilters({
        doctorId,
        bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
        isPreBooked: false,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
      });
      const maxQueue = slot?.maxQueueSize ?? 10;
      if (walkInCount >= maxQueue) {
        throw new ApiException(
          MessageCodes.QUEUE_SLOT_FULL,
          `Walk-in queue is full for this doctor today (max ${maxQueue})`,
          409,
          'Direct service booking failed',
        );
      }
    }

    const bookingCode = await this.generateBookingCode(bookingDate);
    const primaryService = services[0];
    let endTime: string | undefined;
    if (isPreBooked && startTime) {
      endTime = this.validator.calculateEndTime(
        startTime,
        primaryService.durationMinutes,
      );
    }

    const result = await this.bookingRepository.transaction(async (tx) => {
      // 1. Create Booking
      const newBooking = await tx.booking.create({
        data: {
          patientProfileId,
          doctorId,
          serviceId: primaryService.id, // Primary service for booking record
          bookingCode,
          bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
          startTime: isPreBooked ? startTime : undefined,
          endTime: isPreBooked ? endTime : undefined,
          isPreBooked,
          status: BookingStatus.CONFIRMED,
          source: BookingSource.WALK_IN,
          priority,
          patientNotes,
          bookedBy: createdById,
          confirmedAt: new Date(),
          roomId: slot?.roomId ?? undefined,
        },
        include: BookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.CONFIRMED,
          changedById: createdById,
          reason:
            'Mode B — Direct service walk-in: patient knows what service they need',
        },
      });

      // 2. Create MedicalRecord rút gọn — bỏ qua SYMPTOMS_TAKEN
      const medicalRecord = await tx.medicalRecord.create({
        data: {
          bookingId: newBooking.id,
          patientProfileId,
          doctorId,
          visitStep: VisitStep.SERVICES_ORDERED,
          orderedAt: new Date(),
          version: 1,
        },
      });

      // 3. Create LabOrder / VisitServiceOrder for each service and separate invoices
      const labOrdersToInvoice: Array<{
        service: (typeof services)[0];
        orderId: string;
      }> = [];
      const visitOrdersToInvoice: Array<{
        service: (typeof services)[0];
        orderId: string;
      }> = [];

      for (const svc of services) {
        if (svc.performerType === 'TECHNICIAN') {
          const labOrder = await tx.labOrder.create({
            data: {
              medicalRecordId: medicalRecord.id,
              serviceId: svc.id,
              patientProfileId,
              bookingId: newBooking.id,
              doctorId,
              testName: svc.name,
              status: 'PENDING',
            },
          });
          labOrdersToInvoice.push({ service: svc, orderId: labOrder.id });
        } else {
          // DOCTOR performer — use explicit assignment from DTO, fall back to doctorServices[0]
          type ServiceWithDoctor = Prisma.ServiceGetPayload<{
            include: {
              doctorServices: {
                include: {
                  doctorProfile: {
                    include: { user: { select: { id: true } } };
                  };
                };
              };
            };
          }>;

          const explicitAssignment = dto.serviceAssignments?.find(
            (a) => a.serviceId === svc.id,
          );
          const fallbackUserId =
            (svc as ServiceWithDoctor).doctorServices?.[0]?.doctorProfile?.user
              ?.id ?? null;

          const performingUserId =
            explicitAssignment?.performingDoctorId ?? fallbackUserId ?? null;

          const visitOrder = await tx.visitServiceOrder.create({
            data: {
              medicalRecordId: medicalRecord.id,
              serviceId: svc.id,
              patientProfileId,
              bookingId: newBooking.id,
              orderedBy: doctorId,
              performedBy: performingUserId,
              status: 'PENDING',
            },
          });
          visitOrdersToInvoice.push({ service: svc, orderId: visitOrder.id });
        }
      }

      // 4. Create Invoices (split by type: LAB and CONSULTATION)
      let currentInvoiceCount = await tx.invoice.count();

      // Create LAB invoice
      if (labOrdersToInvoice.length > 0) {
        const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(currentInvoiceCount + 1).padStart(4, '0')}`;
        currentInvoiceCount++;
        const totalAmount = labOrdersToInvoice.reduce(
          (sum, item) => sum + Number(item.service.price),
          0,
        );

        await tx.invoice.create({
          data: {
            bookingId: newBooking.id,
            patientProfileId,
            invoiceType: 'LAB',
            invoiceNumber,
            subtotal: totalAmount,
            discountAmount: 0,
            vatRate: 0,
            vatAmount: 0,
            taxAmount: 0,
            totalAmount,
            status: 'DRAFT',
            notes: 'Mode B — Thu tiền tại quầy lễ tân (Dịch vụ CLS).',
            items: {
              create: labOrdersToInvoice.map((item, idx) => ({
                itemName: item.service.name,
                unitPrice: Number(item.service.price),
                quantity: 1,
                totalPrice: Number(item.service.price),
                sortOrder: idx,
                labOrderId: item.orderId,
                serviceId: item.service.id,
              })),
            },
          },
        });
      }

      // Create CONSULTATION (Specialist) invoice
      if (visitOrdersToInvoice.length > 0) {
        const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(currentInvoiceCount + 1).padStart(4, '0')}`;
        currentInvoiceCount++;
        const totalAmount = visitOrdersToInvoice.reduce(
          (sum, item) => sum + Number(item.service.price),
          0,
        );

        await tx.invoice.create({
          data: {
            bookingId: newBooking.id,
            patientProfileId,
            invoiceType: 'CONSULTATION',
            invoiceNumber,
            subtotal: totalAmount,
            discountAmount: 0,
            vatRate: 0,
            vatAmount: 0,
            taxAmount: 0,
            totalAmount,
            status: 'DRAFT',
            notes: 'Mode B — Thu tiền tại quầy lễ tân (Khám chuyên khoa).',
            items: {
              create: visitOrdersToInvoice.map((item, idx) => ({
                itemName: item.service.name,
                unitPrice: Number(item.service.price),
                quantity: 1,
                totalPrice: Number(item.service.price),
                sortOrder: idx,
                visitServiceOrderId: item.orderId,
                serviceId: item.service.id,
              })),
            },
          },
        });
      }

      return newBooking;
    });

    // Notify receptionists of new direct service booking
    await this.notificationsService.notifyRole({
      role: UserRole.RECEPTIONIST,
      title: 'Đặt thẳng dịch vụ mới',
      content: `Bệnh nhân ${result.patientProfile.fullName} đã đăng ký ${services.length} dịch vụ trực tiếp. Vui lòng thu phí.`,
      type: NotificationType.SYSTEM,
      metadata: { bookingId: result.id, source: 'DIRECT_SERVICE' },
    });

    return ResponseHelper.success(
      result,
      'BOOKING.DIRECT_SERVICE_CREATED',
      'Direct service booking created successfully',
      201,
    );
  }

  /**
   * B2 — Mô hình A: BS tư vấn xác định dịch vụ chuyên khoa sau khi hỏi thăm bệnh nhân.
   * Triggers auto-create of CONSULTATION invoice.
   */
  async assignSpecialistService(
    bookingId: string,
    serviceId: string,
    doctorId: string,
    newDoctorId?: string,
  ): Promise<ApiResponse<any>> {
    const booking = await this.bookingRepository.findUniqueBooking({
      where: { id: bookingId },
      include: BookingInclude,
    });
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
    await this.bookingNotification.notifyReceptionistsOfPayment(
      booking,
      service.name,
    );

    return ResponseHelper.success(
      updated,
      'BOOKING.SERVICE_UPDATED',
      'Booking service and specialist updated successfully. Patient referred to reception.',
    );
  }

  async findAll(filterDto: FilterBookingDto): Promise<ApiResponse<any>> {
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
   * Find one booking by ID with ownership validation
   */
  async findOne(id: string, currentUser?: Express.User) {
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

    // Ownership & Permission Validation
    if (currentUser) {
      const isPatient = currentUser.role === UserRole.PATIENT;
      const isDoctor = currentUser.role === UserRole.DOCTOR;
      const isStaff =
        currentUser.role === UserRole.ADMIN ||
        currentUser.role === UserRole.RECEPTIONIST;

      if (isPatient) {
        // Patient can only see their own bookings
        if (booking.patientProfile.userId !== currentUser.id) {
          throw new ApiException(
            MessageCodes.UNAUTHORIZED,
            'You are not authorized to view this booking',
            403,
          );
        }
      } else if (isDoctor) {
        // Doctor can only see their assigned bookings
        const isAssignedDoctor = booking.doctorId === currentUser.id;

        // If not the main doctor, check if they are assigned to any PAID clinical service order for this booking
        let isSpecialistDoctor = false;
        if (!isAssignedDoctor) {
          const vso = await this.clinicalRepository.findFirstVisitServiceOrder({
            where: {
              medicalRecord: { bookingId: booking.id },
              performedBy: currentUser.id,
              status: { in: ['PAID', 'IN_PROGRESS'] }, // Allow if paid or already started
            },
          });
          isSpecialistDoctor = !!vso;
        }

        if (!isAssignedDoctor && !isSpecialistDoctor && !isStaff) {
          throw new ApiException(
            MessageCodes.UNAUTHORIZED,
            'You are not authorized to view this booking',
            403,
          );
        }
      }
      // Staff (Admin/Receptionist) always allowed
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
    changedById?: string | null,
    currentUser?: Express.User,
  ) {
    const { status, reason, doctorNotes } = updateStatusDto;

    const bookingResponse = await this.findOne(id, currentUser);
    const booking = bookingResponse.data;

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Status update failed',
      );
    }

    this.validator.validateStatusTransition(booking.status, status);

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
            changedById: changedById!,
            reason: reason!,
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
        if (
          status === BookingStatus.IN_PROGRESS ||
          status === BookingStatus.AWAITING_RESULTS
        ) {
          this.queueGateway.broadcastQueueUpdate(updated.doctorId, 'UPDATE', {
            booking: updated,
          });
        }

        // B2: When doctor calls patient (IN_PROGRESS), auto-create CONSULTATION invoice
        // if doctor has a consultationFee > 0. Patient will pay at B3 (reception counter).
        if (status === BookingStatus.IN_PROGRESS) {
          const doctorUser = await tx.user.findUnique({
            where: { id: updated.doctorId },
            include: { doctorProfile: { select: { consultationFee: true } } },
          });
          const fee = Number(doctorUser?.doctorProfile?.consultationFee ?? 0);

          if (fee > 0) {
            const existingConsultation = await tx.invoice.findFirst({
              where: {
                bookingId: id,
                invoiceType: 'CONSULTATION',
                status: { notIn: ['CANCELLED'] },
              },
            });
            if (!existingConsultation) {
              const count = await tx.invoice.count();
              const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
              await tx.invoice.create({
                data: {
                  bookingId: id,
                  patientProfileId: updated.patientProfileId,
                  invoiceType: 'CONSULTATION',
                  invoiceNumber,
                  subtotal: fee,
                  discountAmount: 0,
                  vatRate: 0,
                  vatAmount: 0,
                  taxAmount: 0,
                  totalAmount: fee,
                  status: 'DRAFT',
                  notes: 'Phí tư vấn — thu tại bước B3 khi BN ra quầy lễ tân',
                  items: {
                    create: {
                      itemName: 'Phí khám tư vấn',
                      unitPrice: fee,
                      quantity: 1,
                      totalPrice: fee,
                      sortOrder: 0,
                    },
                  },
                },
              });
            }
          }
        }

        // B2: When doctor calls patient (IN_PROGRESS), notify patient
        if (status === BookingStatus.IN_PROGRESS) {
          const patientUserId = updated.patientProfile?.userId;
          if (patientUserId) {
            this.notificationsService
              .createInAppNotification({
                userId: patientUserId,
                title: 'Đã đến lượt khám của bạn',
                content: `Bác sĩ ${updated.doctor?.fullName ?? ''} đang chờ bạn. Vui lòng di chuyển vào phòng ${updated.roomId || 'khám'}.`,
                type: NotificationType.SYSTEM,
                metadata: { bookingId: updated.id, roomId: updated.roomId },
              })
              .catch((err) =>
                this.logger.error(
                  'Failed to notify patient of IN_PROGRESS',
                  err,
                ),
              );
          }
        }

        return updated;
      },
    );

    if (status === BookingStatus.CANCELLED) {
      this.bookingNotification
        .sendCancellationNotification(updatedBooking)
        .catch((error) => {
          console.error('Failed to send cancellation notification:', error);
        });
    }

    if (status === BookingStatus.CONFIRMED) {
      this.bookingNotification
        .sendStatusSpecificNotification(updatedBooking)
        .catch((error) => {
          console.error('Failed to send confirmation notification:', error);
        });
    }

    // Notify admins of status change
    const statusLabels: Record<string, string> = {
      CONFIRMED: 'đã xác nhận',
      CHECKED_IN: 'đã check-in',
      COMPLETED: 'đã hoàn thành',
      CANCELLED: 'đã hủy',
    };
    if (statusLabels[status]) {
      await this.bookingNotification.notifyAdminsOfBooking(
        updatedBooking,
        'UPDATED',
      );
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
  async cancelBooking(
    id: string,
    userId: string,
    reason?: string,
    currentUser?: User,
  ): Promise<ApiResponse<any>> {
    const result = await this.updateStatus(
      id,
      {
        status: BookingStatus.CANCELLED,
        reason: reason || 'Cancelled by user',
      },
      userId,
      currentUser,
    );

    const booking = result.data;
    if (!booking) return result;

    // Notify admins of cancellation
    await this.bookingNotification.notifyAdminsOfBooking(
      booking,
      'CANCELLED',
      reason ? `Lý do: ${reason}` : undefined,
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
  async remove(
    id: string,
    userId: string,
    currentUser?: User,
  ): Promise<ApiResponse<any>> {
    const result = await this.cancelBooking(
      id,
      userId,
      'Booking deleted',
      currentUser,
    );

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
  async startExamination(
    id: string,
    userId: string,
    currentUser?: Express.User,
  ) {
    const bookingResponse = await this.findOne(id, currentUser);
    const booking = bookingResponse.data;

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
      userId, // This is the currentUser.id passed from controller
      currentUser,
    );
  }

  /**
   * Complete visit (Move from IN_PROGRESS to COMPLETED)
   */
  async completeVisit(
    id: string,
    userId: string,
    doctorNotes: string,
    currentUser?: Express.User,
  ) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.COMPLETED,
        reason: 'Consultation finished',
        doctorNotes,
      },
      userId,
      currentUser,
    );
  }

  /**
   * Mark as no-show (Move from CHECKED_IN to NO_SHOW)
   */
  async markNoShow(
    id: string,
    userId: string | null,
    currentUser?: Express.User,
  ) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.NO_SHOW,
        reason: 'Patient did not arrive within 30 minutes of check-in',
      },
      userId,
      currentUser,
    );
  }

  /**
   * Get my bookings (for current patient — filter by patientProfile.userId)
   */
  async findMyBookings(
    userId: string,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<ApiResponse<any>> {
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
  async findMyPatients(
    doctorId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      currentUser?: User;
    },
  ): Promise<ApiResponse<any>> {
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
    const result = await this.queueService.addToQueue(bookingId, userId);
    return result;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Generate a human-readable booking code: BK-YYYYMMDD-NNNN
   */
  private async generateBookingCode(bookingDate: string): Promise<string> {
    const compact = bookingDate.replace(/-/g, '');
    const prefix = `BK-${compact}-`;

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
   * Handle booking completion logic
   */
  private async handleBookingCompletion(booking: {
    id: string;
    doctorId: string;
    bookingDate: Date;
    startTime: string;
  }): Promise<void> {
    await this.queueService.removeFromQueue(booking.id);

    this.queueGateway.broadcastQueueUpdate(booking.doctorId, 'UPDATE', {
      bookingId: booking.id,
      status: 'REMOVED',
    });
  }

  async getReceptionistDashboardStats(): Promise<ApiResponse<any>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    interface DashboardStatResult {
      status: BookingStatus;
      _count: {
        _all: number;
      };
    }

    const stats = (await this.bookingRepository.groupByBooking({
      by: ['status'],
      where: {
        bookingDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      _count: {
        _all: true,
      },
    })) as DashboardStatResult[];

    const result = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    stats.forEach((s) => {
      const statusKey = s.status.toLowerCase();
      if (statusKey in result) {
        result[statusKey as keyof typeof result] = s._count._all;
      }
    });

    return ResponseHelper.success(
      {
        pending: { value: result.pending, trend: 0, trendDir: 'neutral' },
        confirmed: { value: result.confirmed, trend: 0, trendDir: 'neutral' },
        completed: { value: result.completed, trend: 0, trendDir: 'neutral' },
        cancelled: { value: result.cancelled, trend: 0, trendDir: 'neutral' },
      },
      MessageCodes.BOOKING_LIST_RETRIEVED,
      'Receptionist dashboard stats fetched successfully',
    );
  }
}
