import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';
import { I_USER_REPOSITORY } from '../database/interfaces/user.repository.interface';
import { I_CATALOG_REPOSITORY } from '../database/interfaces/catalog.repository.interface';
import { I_PROFILE_REPOSITORY } from '../database/interfaces/profile.repository.interface';
import { I_CLINICAL_REPOSITORY } from '../database/interfaces/clinical.repository.interface';
import { BookingValidatorService } from './services/booking-validator.service';
import { BookingNotificationService } from './services/booking-notification.service';
import { QueueGateway } from '../queue/queue.gateway';
import { QueueService } from '../queue/queue.service';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SequenceService } from '../database/services/sequence.service';
import { RedisService } from '../database/services/redis.service';
import { BookingStatus, BookingSource, BookingPriority } from '@prisma/client';

describe('BookingsService Unit Tests', () => {
  let service: BookingsService;

  // Mocked dependencies
  const mockBookingRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    findConflictingBooking: jest.fn(),
    findDoctorScheduleSlot: jest.fn(),
    transaction: jest.fn().mockImplementation(
      (
        cb: (tx: {
          booking: {
            count: jest.Mock;
            create: jest.Mock;
          };
          bookingStatusHistory: {
            create: jest.Mock;
          };
          slotReservation: {
            deleteMany: jest.Mock;
          };
        }) => Promise<unknown>,
      ) => {
        const txMock = {
          booking: {
            count: jest.fn().mockResolvedValue(0),
            create: jest
              .fn()
              .mockImplementation(
                (args: unknown) =>
                  mockBookingRepository.create(args) as Promise<unknown>,
              ),
          },
          bookingStatusHistory: {
            create: jest.fn(),
          },
          slotReservation: {
            deleteMany: jest.fn(),
          },
        };
        return cb(txMock);
      },
    ),
  };

  const mockUserRepository = {
    findById: jest.fn(),
  };

  const mockCatalogRepository = {
    findServiceById: jest.fn(),
  };

  const mockProfileRepository = {
    findPatientProfileById: jest.fn(),
  };

  const mockClinicalRepository = {
    createVisit: jest.fn(),
  };

  const mockValidator = {
    validateBooking: jest.fn(),
    checkSlotAvailability: jest.fn(),
    calculateEndTime: jest
      .fn()
      .mockImplementation((startTime: string, duration: number): string => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60);
        const endMinutes = totalMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      }),
    validateStatusTransition: jest.fn(),
  };

  const mockBookingNotification = {
    sendBookingNotification: jest.fn().mockResolvedValue(undefined),
    notifyAdminsOfBooking: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueueGateway = {
    emitQueueUpdate: jest.fn(),
  };

  const mockQueueService = {
    addToQueue: jest.fn(),
  };

  const mockBillingService = {
    createInvoice: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationsService = {
    create: jest.fn(),
    notifyRole: jest.fn().mockResolvedValue(undefined),
  };

  const mockSequenceService = {
    generateNextSequence: jest.fn().mockResolvedValue(1),
  };

  const mockRedisService = {
    isReady: jest.fn().mockReturnValue(false),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: I_BOOKING_REPOSITORY, useValue: mockBookingRepository },
        { provide: I_USER_REPOSITORY, useValue: mockUserRepository },
        { provide: I_CATALOG_REPOSITORY, useValue: mockCatalogRepository },
        { provide: I_PROFILE_REPOSITORY, useValue: mockProfileRepository },
        { provide: I_CLINICAL_REPOSITORY, useValue: mockClinicalRepository },
        { provide: BookingValidatorService, useValue: mockValidator },
        {
          provide: BookingNotificationService,
          useValue: mockBookingNotification,
        },
        { provide: QueueGateway, useValue: mockQueueGateway },
        { provide: QueueService, useValue: mockQueueService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: SequenceService, useValue: mockSequenceService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create pre-booking', () => {
    it('should successfully create a booking when validation passes', async () => {
      const mockDto = {
        patientProfileId: 'patient-profile-id',
        doctorId: 'doctor-id',
        serviceId: 'service-id',
        bookingDate: '2026-06-01',
        startTime: '09:00',
        endTime: '09:30',
      };

      const mockCreatedBooking = {
        id: 'new-booking-id',
        bookingCode: 'BK2605240001',
        patientProfileId: 'patient-profile-id',
        doctorId: 'doctor-id',
        serviceId: 'service-id',
        bookingDate: new Date('2026-06-01'),
        startTime: '09:00',
        endTime: '09:30',
        status: BookingStatus.PENDING,
        source: BookingSource.ONLINE,
        priority: BookingPriority.NORMAL,
        patientProfile: {
          id: 'patient-profile-id',
          fullName: 'Test Patient',
        },
        service: {
          id: 'service-id',
          name: 'Consultation',
        },
      };

      // Set up mock resolves
      mockValidator.validateBooking.mockResolvedValue(undefined);
      mockValidator.checkSlotAvailability.mockResolvedValue(true);
      mockCatalogRepository.findServiceById.mockResolvedValue({
        id: 'service-id',
        name: 'Consultation',
        durationMinutes: 30,
        maxSlotsPerHour: 2,
      });
      mockBookingRepository.create.mockResolvedValue(mockCreatedBooking);

      const result = await service.create(mockDto, 'created-by-user-id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedBooking);
      expect(mockSequenceService.generateNextSequence).toHaveBeenCalled();
      expect(mockBookingRepository.create).toHaveBeenCalled();
    });
  });
});
