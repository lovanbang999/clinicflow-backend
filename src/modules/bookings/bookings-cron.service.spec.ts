import { Test, TestingModule } from '@nestjs/testing';
import { BookingsCronService } from './bookings-cron.service';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../database/interfaces/booking.repository.interface';
import { BookingsService } from './bookings.service';
import { QueueService } from '../queue/queue.service';

type MockBookingRepo = Partial<Record<keyof IBookingRepository, jest.Mock>>;

describe('BookingsCronService', () => {
  let service: BookingsCronService;
  let bookingRepository: MockBookingRepo;
  let bookingsServiceMock: Record<string, jest.Mock>;
  let queueServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    bookingRepository = {
      findOverduePreBookings: jest.fn(),
    };

    bookingsServiceMock = {
      markNoShow: jest.fn(),
    };

    queueServiceMock = {
      recalculateEstimatedTimes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsCronService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepository },
        { provide: BookingsService, useValue: bookingsServiceMock },
        { provide: QueueService, useValue: queueServiceMock },
      ],
    }).compile();

    service = module.get<BookingsCronService>(BookingsCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleAutoNoShow', () => {
    it('should return early if no overdue bookings are found', async () => {
      bookingRepository.findOverduePreBookings!.mockResolvedValue([]);

      await service.handleAutoNoShow();

      expect(bookingRepository.findOverduePreBookings).toHaveBeenCalled();
      expect(bookingsServiceMock.markNoShow).not.toHaveBeenCalled();
    });

    it('should mark overdue bookings as NO_SHOW and recalculate estimated wait times', async () => {
      const mockOverdue = [
        {
          id: 'booking-1',
          bookingCode: 'BK-001',
          doctorId: 'doctor-1',
          bookingDate: new Date('2026-06-01'),
        },
      ];
      bookingRepository.findOverduePreBookings!.mockResolvedValue(mockOverdue);
      bookingsServiceMock.markNoShow.mockResolvedValue({});
      queueServiceMock.recalculateEstimatedTimes.mockResolvedValue({});

      await service.handleAutoNoShow();

      expect(bookingsServiceMock.markNoShow).toHaveBeenCalledWith(
        'booking-1',
        null,
      );
      expect(queueServiceMock.recalculateEstimatedTimes).toHaveBeenCalledWith(
        'doctor-1',
        '2026-06-01',
      );
    });

    it('should catch errors when marking a booking as no-show and continue processing other bookings', async () => {
      const mockOverdue = [
        {
          id: 'booking-1',
          bookingCode: 'BK-001',
          doctorId: 'doctor-1',
          bookingDate: new Date('2026-06-01'),
        },
        {
          id: 'booking-2',
          bookingCode: 'BK-002',
          doctorId: 'doctor-2',
          bookingDate: new Date('2026-06-01'),
        },
      ];
      bookingRepository.findOverduePreBookings!.mockResolvedValue(mockOverdue);
      bookingsServiceMock.markNoShow
        .mockRejectedValueOnce(new Error('Mark no-show failed'))
        .mockResolvedValueOnce({});
      queueServiceMock.recalculateEstimatedTimes.mockResolvedValue({});

      await service.handleAutoNoShow();

      expect(bookingsServiceMock.markNoShow).toHaveBeenCalledTimes(2);
      expect(bookingsServiceMock.markNoShow).toHaveBeenNthCalledWith(
        1,
        'booking-1',
        null,
      );
      expect(bookingsServiceMock.markNoShow).toHaveBeenNthCalledWith(
        2,
        'booking-2',
        null,
      );
      expect(queueServiceMock.recalculateEstimatedTimes).toHaveBeenCalledWith(
        'doctor-2',
        '2026-06-01',
      );
    });
  });
});
