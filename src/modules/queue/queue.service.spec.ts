import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../database/interfaces/booking.repository.interface';
import {
  I_CLINICAL_REPOSITORY,
  IClinicalRepository,
} from '../database/interfaces/clinical.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueGateway } from './queue.gateway';
import { BookingStatus } from '@prisma/client';
import { ApiException } from '../../common/exceptions/api.exception';
import { BadRequestException } from '@nestjs/common';
import { MessageCodes } from '../../common/constants/message-codes.const';

type MockBookingRepo = Partial<Record<keyof IBookingRepository, jest.Mock>>;
type MockClinicalRepo = Partial<Record<keyof IClinicalRepository, jest.Mock>>;

const buildBookingForQueue = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  doctorId: 'doctor-1',
  bookingDate: new Date('2026-07-01'),
  status: BookingStatus.CONFIRMED,
  isPreBooked: false,
  startTime: null,
  patientProfile: { fullName: 'Patient A', userId: 'user-1' },
  ...overrides,
});

const buildQueueRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'queue-1',
  bookingId: 'booking-1',
  doctorId: 'doctor-1',
  queueDate: new Date('2026-07-01'),
  queuePosition: 1,
  estimatedWaitMinutes: 30,
  isPreBooked: false,
  scheduledTime: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  calledAt: null,
  completedAt: null,
  booking: {
    id: 'booking-1',
    status: BookingStatus.CHECKED_IN,
    bookingDate: new Date('2026-07-01'),
    doctorId: 'doctor-1',
    patientProfile: { id: 'pp-1', userId: 'user-1', fullName: 'Patient A', phone: null, email: null, isGuest: false, patientCode: null },
    doctor: { id: 'doctor-1', email: 'doc@clinic.com', fullName: 'Dr. Smith' },
    service: { id: 'svc-1', name: 'Consultation', durationMinutes: 30, maxSlotsPerHour: 2 },
  },
  ...overrides,
});

describe('QueueService', () => {
  let service: QueueService;
  let bookingRepository: MockBookingRepo;
  let clinicalRepository: MockClinicalRepo;
  let notificationsService: { notifyAdmins: jest.Mock; createInAppNotification: jest.Mock };
  let queueGateway: { broadcastQueueUpdate: jest.Mock };

  beforeEach(async () => {
    bookingRepository = {
      findBookingForQueue: jest.fn(),
      findQueueByBookingId: jest.fn(),
      findLatestQueuePosition: jest.fn(),
      countCheckedInQueue: jest.fn(),
      checkInTransaction: jest.fn(),
      findQueueRecordsPaginated: jest.fn(),
      getQueueStatistics: jest.fn(),
      findBookingWithRelations: jest.fn(),
      countConfirmedBookingsForSlot: jest.fn(),
      promoteQueueTransaction: jest.fn(),
      findFirstInQueue: jest.fn(),
      removeFromQueueAndShiftTransaction: jest.fn(),
      findActivePreBookingsForRecalculation: jest.fn(),
      findActiveWalkInQueueForRecalculation: jest.fn(),
      updateBookingEstimatedTime: jest.fn(),
    };

    clinicalRepository = {
      findDoctorSpecialistQueue: jest.fn().mockResolvedValue([]),
    };

    notificationsService = {
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
      createInAppNotification: jest.fn().mockResolvedValue(undefined),
    };

    queueGateway = {
      broadcastQueueUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepository },
        { provide: I_CLINICAL_REPOSITORY, useValue: clinicalRepository },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: QueueGateway, useValue: queueGateway },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('addToQueue (check-in)', () => {
    it('should check in a pre-booked CONFIRMED booking successfully', async () => {
      // Arrange
      const booking = buildBookingForQueue({ isPreBooked: true, startTime: '09:00', status: BookingStatus.CONFIRMED });
      const checkInResult = { booking: { ...booking, status: BookingStatus.CHECKED_IN }, queue: { queuePosition: 1 } };

      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(booking);
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);
      (bookingRepository.findLatestQueuePosition as jest.Mock).mockResolvedValue(0);
      (bookingRepository.countCheckedInQueue as jest.Mock).mockResolvedValue(2);
      (bookingRepository.checkInTransaction as jest.Mock).mockResolvedValue(checkInResult);
      (bookingRepository.findActivePreBookingsForRecalculation as jest.Mock).mockResolvedValue([]);
      (bookingRepository.findActiveWalkInQueueForRecalculation as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await service.addToQueue('booking-1', 'user-1');

      // Assert
      expect(result).toEqual(checkInResult);
      expect(bookingRepository.checkInTransaction).toHaveBeenCalledWith(
        'booking-1',
        booking.doctorId,
        booking.bookingDate,
        true,      // isPreBooked
        '09:00',   // startTime
        'user-1',
        60,        // estWaitMinutes = 2 * 30
        1,         // currentPosition = 0 + 1
      );
    });

    it('should check in a walk-in booking successfully', async () => {
      // Arrange
      const booking = buildBookingForQueue({ isPreBooked: false, startTime: null, status: BookingStatus.CONFIRMED });
      const checkInResult = { booking: { ...booking }, queue: { queuePosition: 3 } };

      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(booking);
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);
      (bookingRepository.findLatestQueuePosition as jest.Mock).mockResolvedValue(2);
      (bookingRepository.countCheckedInQueue as jest.Mock).mockResolvedValue(0);
      (bookingRepository.checkInTransaction as jest.Mock).mockResolvedValue(checkInResult);
      (bookingRepository.findActivePreBookingsForRecalculation as jest.Mock).mockResolvedValue([]);
      (bookingRepository.findActiveWalkInQueueForRecalculation as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await service.addToQueue('booking-1', 'user-1');

      // Assert
      expect(result).toEqual(checkInResult);
      expect(bookingRepository.checkInTransaction).toHaveBeenCalledWith(
        'booking-1',
        booking.doctorId,
        booking.bookingDate,
        false,   // isPreBooked
        null,    // startTime
        'user-1',
        0,       // estWaitMinutes = 0 * 30
        3,       // currentPosition = 2 + 1
      );
    });

    it('should throw 404 ApiException when booking is not found', async () => {
      // Arrange
      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.addToQueue('missing-booking', 'user-1')).rejects.toThrow(ApiException);
    });

    it('should throw 400 ApiException when booking status is not CONFIRMED', async () => {
      // Arrange
      const booking = buildBookingForQueue({ status: BookingStatus.PENDING });
      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(booking);

      // Act & Assert
      await expect(service.addToQueue('booking-1', 'user-1')).rejects.toMatchObject({
        response: expect.objectContaining({ messageCode: MessageCodes.BOOKING_INVALID_STATUS }),
      });
    });

    it('should throw 409 ApiException when booking is already in queue', async () => {
      // Arrange
      const booking = buildBookingForQueue({ status: BookingStatus.CONFIRMED });
      const existingQueue = buildQueueRecord();
      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(booking);
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(existingQueue);

      // Act & Assert
      await expect(service.addToQueue('booking-1', 'user-1')).rejects.toMatchObject({
        response: expect.objectContaining({ messageCode: MessageCodes.BOOKING_ALREADY_IN_QUEUE }),
      });
    });

    it('should broadcast gateway event after successful check-in', async () => {
      // Arrange
      const booking = buildBookingForQueue({ status: BookingStatus.CONFIRMED });
      const checkInResult = { booking, queue: { queuePosition: 1 } };

      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(booking);
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);
      (bookingRepository.findLatestQueuePosition as jest.Mock).mockResolvedValue(0);
      (bookingRepository.countCheckedInQueue as jest.Mock).mockResolvedValue(0);
      (bookingRepository.checkInTransaction as jest.Mock).mockResolvedValue(checkInResult);
      (bookingRepository.findActivePreBookingsForRecalculation as jest.Mock).mockResolvedValue([]);
      (bookingRepository.findActiveWalkInQueueForRecalculation as jest.Mock).mockResolvedValue([]);

      // Act
      await service.addToQueue('booking-1', 'user-1');

      // Assert
      expect(queueGateway.broadcastQueueUpdate).toHaveBeenCalledWith(
        booking.doctorId,
        'CHECK_IN',
        checkInResult,
      );
    });

    it('should notify admin after successful check-in', async () => {
      // Arrange
      const booking = buildBookingForQueue({ status: BookingStatus.CONFIRMED });
      const checkInResult = { booking, queue: { queuePosition: 1 } };

      (bookingRepository.findBookingForQueue as jest.Mock).mockResolvedValue(booking);
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);
      (bookingRepository.findLatestQueuePosition as jest.Mock).mockResolvedValue(0);
      (bookingRepository.countCheckedInQueue as jest.Mock).mockResolvedValue(0);
      (bookingRepository.checkInTransaction as jest.Mock).mockResolvedValue(checkInResult);
      (bookingRepository.findActivePreBookingsForRecalculation as jest.Mock).mockResolvedValue([]);
      (bookingRepository.findActiveWalkInQueueForRecalculation as jest.Mock).mockResolvedValue([]);

      // Act
      await service.addToQueue('booking-1', 'user-1');

      // Assert
      expect(notificationsService.notifyAdmins).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ bookingId: booking.id }) }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return queue statistics with rounded average wait time', async () => {
      // Arrange
      (bookingRepository.getQueueStatistics as jest.Mock).mockResolvedValue({
        totalQueued: 5,
        avgWaitTime: 22.7,
        longestQueue: 3,
      });

      // Act
      const result = await service.getStatistics('doctor-1', '2026-07-01');

      // Assert
      expect(result).toEqual({
        totalQueued: 5,
        averageWaitTimeMinutes: 23, // Math.round(22.7)
        longestQueuePosition: 3,
      });
    });

    it('should handle null avgWaitTime and longestQueue', async () => {
      // Arrange
      (bookingRepository.getQueueStatistics as jest.Mock).mockResolvedValue({
        totalQueued: 0,
        avgWaitTime: null,
        longestQueue: null,
      });

      // Act
      const result = await service.getStatistics();

      // Assert
      expect(result.averageWaitTimeMinutes).toBe(0);
      expect(result.longestQueuePosition).toBe(0);
    });
  });

  describe('findByBookingId', () => {
    it('should return queue record when found directly', async () => {
      // Arrange
      const queueRecord = buildQueueRecord();
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(queueRecord);

      // Act
      const result = await service.findByBookingId('booking-1');

      // Assert
      expect(result).toEqual(queueRecord);
    });

    it('should return synthetic queue record when queue is missing but booking exists', async () => {
      // Arrange
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);
      const booking = {
        id: 'booking-1',
        doctorId: 'doctor-1',
        bookingDate: new Date('2026-07-01'),
        isPreBooked: false,
        startTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (bookingRepository.findBookingWithRelations as jest.Mock).mockResolvedValue(booking);

      // Act
      const result = await service.findByBookingId('booking-1');

      // Assert
      expect(result.id).toBe('synth-booking-1');
      expect(result.queuePosition).toBe(0);
      expect(result.booking).toEqual(booking);
    });

    it('should throw ApiException when neither queue nor booking is found', async () => {
      // Arrange
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);
      (bookingRepository.findBookingWithRelations as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByBookingId('missing')).rejects.toThrow(ApiException);
    });
  });

  describe('promoteManually', () => {
    it('should promote a booking and broadcast gateway event', async () => {
      // Arrange
      const queueRecord = buildQueueRecord();
      const promotedQueue = { ...queueRecord, id: 'queue-promoted' };

      // findByBookingId returns a QueueRecordWithRelations, so mock findQueueByBookingId
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(queueRecord);
      (bookingRepository.countConfirmedBookingsForSlot as jest.Mock).mockResolvedValue(0); // slot available
      (bookingRepository.promoteQueueTransaction as jest.Mock).mockResolvedValue(promotedQueue);

      // Act
      const result = await service.promoteManually(
        { bookingId: 'booking-1', reason: 'Priority patient' },
        'admin-1',
      );

      // Assert
      expect(result).toEqual(promotedQueue);
      expect(bookingRepository.promoteQueueTransaction).toHaveBeenCalledWith(
        'booking-1',
        'admin-1',
        'Priority patient',
      );
      expect(queueGateway.broadcastQueueUpdate).toHaveBeenCalledWith(
        queueRecord.booking.doctorId,
        'PROMOTED',
        promotedQueue,
      );
    });

    it('should throw BadRequestException if booking is not in CHECKED_IN status', async () => {
      // Arrange
      const queueRecord = buildQueueRecord({
        booking: {
          ...buildQueueRecord().booking,
          status: BookingStatus.CONFIRMED,
        },
      });
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(queueRecord);

      // Act & Assert
      await expect(
        service.promoteManually({ bookingId: 'booking-1', reason: '' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ApiException when slot is full', async () => {
      // Arrange
      const queueRecord = buildQueueRecord();
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(queueRecord);
      (bookingRepository.countConfirmedBookingsForSlot as jest.Mock).mockResolvedValue(2); // maxSlotsPerHour = 2, slot full

      // Act & Assert
      await expect(
        service.promoteManually({ bookingId: 'booking-1', reason: '' }, 'admin-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ messageCode: MessageCodes.QUEUE_SLOT_FULL }),
      });
    });
  });

  describe('removeFromQueue', () => {
    it('should remove from queue and broadcast update', async () => {
      // Arrange
      const queueRecord = buildQueueRecord();
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(queueRecord);
      (bookingRepository.removeFromQueueAndShiftTransaction as jest.Mock).mockResolvedValue(undefined);

      // Act
      await service.removeFromQueue('booking-1');

      // Assert
      expect(bookingRepository.removeFromQueueAndShiftTransaction).toHaveBeenCalledWith('booking-1');
      expect(queueGateway.broadcastQueueUpdate).toHaveBeenCalledWith(
        queueRecord.doctorId,
        'UPDATE',
        { bookingId: 'booking-1' },
      );
    });

    it('should silently succeed when booking is not in queue', async () => {
      // Arrange
      (bookingRepository.findQueueByBookingId as jest.Mock).mockResolvedValue(null);

      // Act
      await service.removeFromQueue('not-in-queue');

      // Assert
      expect(bookingRepository.removeFromQueueAndShiftTransaction).not.toHaveBeenCalled();
      expect(queueGateway.broadcastQueueUpdate).not.toHaveBeenCalled();
    });
  });

  describe('autoPromote', () => {
    it('should return false when no one is in queue', async () => {
      // Arrange
      (bookingRepository.findFirstInQueue as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.autoPromote('doctor-1', '2026-07-01', '09:00');

      // Assert
      expect(result).toBe(false);
      expect(bookingRepository.promoteQueueTransaction).not.toHaveBeenCalled();
    });

    it('should return false when slot is still full', async () => {
      // Arrange
      const firstInQueue = { bookingId: 'booking-1', booking: { service: { maxSlotsPerHour: 1 } } };
      (bookingRepository.findFirstInQueue as jest.Mock).mockResolvedValue(firstInQueue);
      (bookingRepository.countConfirmedBookingsForSlot as jest.Mock).mockResolvedValue(1); // full

      // Act
      const result = await service.autoPromote('doctor-1', '2026-07-01', '09:00');

      // Assert
      expect(result).toBe(false);
    });

    it('should promote the first booking and return true when slot available', async () => {
      // Arrange
      const firstInQueue = { bookingId: 'booking-1', booking: { service: { maxSlotsPerHour: 2 } } };
      (bookingRepository.findFirstInQueue as jest.Mock).mockResolvedValue(firstInQueue);
      (bookingRepository.countConfirmedBookingsForSlot as jest.Mock).mockResolvedValue(0);
      (bookingRepository.promoteQueueTransaction as jest.Mock).mockResolvedValue({ id: 'queue-1' });

      // Act
      const result = await service.autoPromote('doctor-1', '2026-07-01', '09:00');

      // Assert
      expect(result).toBe(true);
      expect(bookingRepository.promoteQueueTransaction).toHaveBeenCalledWith(
        'booking-1',
        'system',
        'Auto-promoted from queue',
      );
    });
  });
});
