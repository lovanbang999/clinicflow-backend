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
import {
  BookingStatus,
  BookingSource,
  BookingPriority,
  UserRole,
} from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';

describe('BookingsService Unit Tests', () => {
  let service: BookingsService;

  // Mocked dependencies
  const mockBookingRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    findConflictingBooking: jest.fn(),
    findDoctorScheduleSlot: jest.fn(),
    createOnlinePreBookingTransaction: jest.fn(),
    countActiveWalkInBookings: jest.fn(),
    createReceptionistBookingTransaction: jest.fn(),
    createDirectServiceBookingTransaction: jest.fn(),
    findBookingWithRelations: jest.fn(),
    assignServiceAndMoveToConfirmedTransaction: jest.fn(),
    findBookingsPaginated: jest.fn(),
    findBookingById: jest.fn(),
    updateBookingStatusTransaction: jest.fn(),
    findActiveExamination: jest.fn(),
    findMyBookingsPaginated: jest.fn(),
  };

  const mockUserRepository = {
    findById: jest.fn(),
  };

  const mockCatalogRepository = {
    findServiceById: jest.fn(),
    findActiveServicesWithDoctors: jest.fn(),
  };

  const mockProfileRepository = {
    findPatientProfileById: jest.fn(),
    findPatientProfileByUserId: jest.fn(),
  };

  const mockClinicalRepository = {
    createVisit: jest.fn(),
    hasAccessToVisitServiceOrder: jest.fn(),
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
    sendCancellationNotification: jest.fn().mockResolvedValue(undefined),
    sendStatusSpecificNotification: jest.fn().mockResolvedValue(undefined),
    notifyReceptionistsOfPayment: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueueGateway = {
    broadcastQueueUpdate: jest.fn(),
  };

  const mockQueueService = {
    addToQueue: jest.fn(),
    removeFromQueue: jest.fn(),
  };

  const mockBillingService = {
    createInvoice: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationsService = {
    createInAppNotification: jest.fn().mockResolvedValue(undefined),
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
    jest.clearAllMocks();

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

      mockValidator.validateBooking.mockResolvedValue(undefined);
      mockValidator.checkSlotAvailability.mockResolvedValue(true);
      mockCatalogRepository.findServiceById.mockResolvedValue({
        id: 'service-id',
        name: 'Consultation',
        durationMinutes: 30,
        maxSlotsPerHour: 2,
      });
      mockBookingRepository.createOnlinePreBookingTransaction.mockResolvedValue(
        mockCreatedBooking,
      );

      const result = await service.create(mockDto, 'created-by-user-id');

      expect(result).toEqual(mockCreatedBooking);
      expect(mockSequenceService.generateNextSequence).toHaveBeenCalled();
      expect(
        mockBookingRepository.createOnlinePreBookingTransaction,
      ).toHaveBeenCalled();
    });
  });

  describe('createByReceptionist', () => {
    it('should throw QUEUE_SLOT_FULL if walk-in count exceeds max queue size', async () => {
      mockValidator.validateBooking.mockResolvedValue(undefined);
      mockBookingRepository.findDoctorScheduleSlot.mockResolvedValue({
        maxQueueSize: 5,
      });
      mockBookingRepository.countActiveWalkInBookings.mockResolvedValue(5);

      await expect(
        service.createByReceptionist(
          {
            patientProfileId: 'patient-id',
            doctorId: 'doctor-id',
            bookingDate: '2026-06-01',
            isPreBooked: false,
          },
          'staff-id',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully create receptionist walk-in booking', async () => {
      const mockCreated = {
        id: 'booking-2',
        bookingCode: 'BK-2',
        patientProfile: { fullName: 'Patient' },
      };
      mockValidator.validateBooking.mockResolvedValue(undefined);
      mockBookingRepository.findDoctorScheduleSlot.mockResolvedValue({
        maxQueueSize: 10,
        roomId: 'room-1',
      });
      mockBookingRepository.countActiveWalkInBookings.mockResolvedValue(2);
      mockBookingRepository.createReceptionistBookingTransaction.mockResolvedValue(
        mockCreated,
      );

      const result = await service.createByReceptionist(
        {
          patientProfileId: 'patient-id',
          doctorId: 'doctor-id',
          bookingDate: '2026-06-01',
          isPreBooked: false,
        },
        'staff-id',
      );

      expect(result).toEqual(mockCreated);
      expect(
        mockBookingRepository.createReceptionistBookingTransaction,
      ).toHaveBeenCalled();
    });
  });

  describe('createDirectServiceBooking', () => {
    it('should throw SERVICE_NOT_FOUND if requested services are inactive or not found', async () => {
      mockCatalogRepository.findActiveServicesWithDoctors.mockResolvedValue([]);

      await expect(
        service.createDirectServiceBooking(
          {
            patientProfileId: 'patient-id',
            doctorId: 'doctor-id',
            serviceIds: ['svc-1'],
            bookingDate: '2026-06-01',
          },
          'staff-id',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully create direct service booking', async () => {
      const mockServices = [
        {
          id: 'svc-1',
          name: 'Blood Test',
          price: 100000,
          durationMinutes: 15,
          maxSlotsPerHour: 4,
        },
      ];
      mockCatalogRepository.findActiveServicesWithDoctors.mockResolvedValue(
        mockServices,
      );
      mockValidator.validateBooking.mockResolvedValue(undefined);
      mockBookingRepository.findDoctorScheduleSlot.mockResolvedValue({
        maxQueueSize: 10,
      });
      mockBookingRepository.countActiveWalkInBookings.mockResolvedValue(0);

      const mockResult = {
        id: 'booking-3',
        patientProfile: { fullName: 'Patient Name' },
      };
      mockBookingRepository.createDirectServiceBookingTransaction.mockResolvedValue(
        mockResult,
      );

      const result = await service.createDirectServiceBooking(
        {
          patientProfileId: 'patient-id',
          doctorId: 'doctor-id',
          serviceIds: ['svc-1'],
          bookingDate: '2026-06-01',
        },
        'staff-id',
      );

      expect(result).toEqual(mockResult);
      expect(mockNotificationsService.notifyRole).toHaveBeenCalled();
    });
  });

  describe('assignSpecialistService', () => {
    it('should throw if old doctor is not the caller doctor', async () => {
      mockBookingRepository.findBookingWithRelations.mockResolvedValue({
        id: 'booking-1',
        doctorId: 'doctor-original',
      });

      await expect(
        service.assignSpecialistService(
          'booking-1',
          'svc-1',
          'doctor-malicious',
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully assign service and trigger invoice creation', async () => {
      mockBookingRepository.findBookingWithRelations.mockResolvedValue({
        id: 'booking-1',
        doctorId: 'doctor-1',
        status: BookingStatus.IN_PROGRESS,
      });
      mockCatalogRepository.findServiceById.mockResolvedValue({
        id: 'svc-1',
        name: 'Specialist',
        isActive: true,
      });
      mockQueueService.removeFromQueue.mockResolvedValue(undefined);
      mockBookingRepository.assignServiceAndMoveToConfirmedTransaction.mockResolvedValue(
        { id: 'booking-1' },
      );

      const result = await service.assignSpecialistService(
        'booking-1',
        'svc-1',
        'doctor-1',
      );

      expect(result).toEqual({ id: 'booking-1' });
      expect(mockQueueService.removeFromQueue).toHaveBeenCalledWith(
        'booking-1',
      );
      expect(mockBillingService.createInvoice).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw if booking not found', async () => {
      mockBookingRepository.findBookingById.mockResolvedValue(null);

      await expect(service.findOne('booking-1')).rejects.toThrow(ApiException);
    });

    it('should allow patient to view their own booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        patientProfile: { userId: 'patient-user-id' },
        doctorId: 'doctor-id',
      };
      mockBookingRepository.findBookingById.mockResolvedValue(mockBooking);

      const result = await service.findOne('booking-1', {
        id: 'patient-user-id',
        role: UserRole.PATIENT,
      } as unknown as Express.User);

      expect(result).toEqual(mockBooking);
    });

    it('should restrict patient from viewing others bookings', async () => {
      const mockBooking = {
        id: 'booking-1',
        patientProfile: { userId: 'patient-user-id' },
        doctorId: 'doctor-id',
      };
      mockBookingRepository.findBookingById.mockResolvedValue(mockBooking);

      await expect(
        service.findOne('booking-1', {
          id: 'another-patient-id',
          role: UserRole.PATIENT,
        } as unknown as Express.User),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('updateStatus', () => {
    it('should update booking status and dispatch notifications', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: BookingStatus.CHECKED_IN,
        startTime: '10:00',
        bookingDate: new Date('2026-06-01'),
        doctor: { id: 'doctor-1' },
        patientProfile: { userId: 'patient-user-id' },
      };
      mockBookingRepository.findBookingById.mockResolvedValue(mockBooking);
      mockBookingRepository.updateBookingStatusTransaction.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.IN_PROGRESS,
      });

      const result = await service.updateStatus(
        'booking-1',
        {
          status: BookingStatus.IN_PROGRESS,
          reason: 'Call patient',
        },
        'staff-1',
      );

      expect(result.status).toBe(BookingStatus.IN_PROGRESS);
      expect(mockValidator.validateStatusTransition).toHaveBeenCalledWith(
        BookingStatus.CHECKED_IN,
        BookingStatus.IN_PROGRESS,
      );
      expect(mockQueueGateway.broadcastQueueUpdate).toHaveBeenCalled();
    });
  });

  describe('startExamination', () => {
    it('should throw if doctor is busy with another active examination', async () => {
      mockBookingRepository.findBookingById.mockResolvedValue({
        id: 'booking-1',
        doctorId: 'doctor-1',
      });
      mockBookingRepository.findActiveExamination.mockResolvedValue({
        id: 'booking-busy',
      });

      await expect(
        service.startExamination('booking-1', 'doctor-1'),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully start examination', async () => {
      const mockBooking = {
        id: 'booking-1',
        doctorId: 'doctor-1',
        doctor: { id: 'doctor-1' },
        patientProfile: { userId: 'patient-1' },
      };
      mockBookingRepository.findBookingById.mockResolvedValue(mockBooking);
      mockBookingRepository.findActiveExamination.mockResolvedValue(null);

      mockBookingRepository.updateBookingStatusTransaction.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.IN_PROGRESS,
      });

      const result = await service.startExamination('booking-1', 'doctor-1');
      expect(result.status).toBe(BookingStatus.IN_PROGRESS);
    });
  });
});
