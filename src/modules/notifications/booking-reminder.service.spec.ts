import { Test, TestingModule } from '@nestjs/testing';
import { BookingReminderService } from './booking-reminder.service';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../database/interfaces/booking.repository.interface';
import { NotificationsService } from './notifications.service';
import { BookingStatus } from '@prisma/client';

type MockBookingRepo = Partial<Record<keyof IBookingRepository, jest.Mock>>;

const buildBooking = (
  overrides: Partial<{
    id: string;
    bookingCode: string;
    startTime: string;
    endTime: string;
    status: BookingStatus;
    patientProfile: {
      userId: string;
      fullName: string;
      user: { email: string } | null;
    } | null;
    doctor: { fullName: string } | null;
    service: { name: string; durationMinutes: number } | null;
  }> = {},
) => ({
  id: 'booking-1',
  bookingCode: 'BK001',
  startTime: '08:00',
  endTime: '08:30',
  status: BookingStatus.CONFIRMED,
  patientProfile: {
    userId: 'user-1',
    fullName: 'Nguyen Van A',
    user: { email: 'patient@example.com' },
  },
  doctor: { fullName: 'Dr. Smith' },
  service: { name: 'Consultation', durationMinutes: 30 },
  ...overrides,
});

describe('BookingReminderService', () => {
  let service: BookingReminderService;
  let bookingRepository: MockBookingRepo;
  let notificationsService: { sendBookingReminder: jest.Mock };

  beforeEach(async () => {
    bookingRepository = {
      findConfirmedBookingsInTimeRange: jest.fn(),
    };

    notificationsService = {
      sendBookingReminder: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingReminderService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepository },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<BookingReminderService>(BookingReminderService);
  });

  describe('sendTomorrowReminders', () => {
    it('should find confirmed bookings in tomorrow date range and send reminders', async () => {
      // Arrange
      const booking = buildBooking();
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([booking]);

      // Act
      await service.sendTomorrowReminders();

      // Assert
      expect(
        bookingRepository.findConfirmedBookingsInTimeRange,
      ).toHaveBeenCalledTimes(1);
      const [start, end]: [Date, Date] = (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mock.calls[0] as [Date, Date];
      // start and end should span tomorrow
      expect(end.getTime()).toBeGreaterThan(start.getTime());
      // Roughly 24 hours apart
      expect(end.getTime() - start.getTime()).toBeGreaterThan(
        23 * 60 * 60 * 1000,
      );

      expect(notificationsService.sendBookingReminder).toHaveBeenCalledTimes(1);
      expect(notificationsService.sendBookingReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'BK001',
          patientId: 'user-1',
          patientName: 'Nguyen Van A',
          patientEmail: 'patient@example.com',
          doctorName: 'Dr. Smith',
          serviceName: 'Consultation',
          startTime: '08:00',
          endTime: '08:30',
          duration: 30,
          status: BookingStatus.CONFIRMED,
        }),
      );
    });

    it('should skip bookings without a patient email', async () => {
      // Arrange
      const bookingNoEmail = buildBooking({
        patientProfile: {
          userId: 'user-2',
          fullName: 'Guest Patient',
          user: null,
        },
      });
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([bookingNoEmail]);

      // Act
      await service.sendTomorrowReminders();

      // Assert
      expect(notificationsService.sendBookingReminder).not.toHaveBeenCalled();
    });

    it('should skip bookings where patientProfile is null', async () => {
      // Arrange
      const bookingNoProfile = buildBooking({ patientProfile: null });
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([bookingNoProfile]);

      // Act
      await service.sendTomorrowReminders();

      // Assert
      expect(notificationsService.sendBookingReminder).not.toHaveBeenCalled();
    });

    it('should handle an empty bookings list without sending any reminders', async () => {
      // Arrange
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([]);

      // Act
      await service.sendTomorrowReminders();

      // Assert
      expect(notificationsService.sendBookingReminder).not.toHaveBeenCalled();
    });

    it('should send reminders for multiple valid bookings', async () => {
      // Arrange
      const booking1 = buildBooking({
        id: 'b1',
        bookingCode: 'BK001',
        patientProfile: {
          userId: 'u1',
          fullName: 'Patient A',
          user: { email: 'a@test.com' },
        },
      });
      const booking2 = buildBooking({
        id: 'b2',
        bookingCode: 'BK002',
        patientProfile: {
          userId: 'u2',
          fullName: 'Patient B',
          user: { email: 'b@test.com' },
        },
      });
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([booking1, booking2]);

      // Act
      await service.sendTomorrowReminders();

      // Assert
      expect(notificationsService.sendBookingReminder).toHaveBeenCalledTimes(2);
    });

    it('should use fallback defaults when optional fields are missing', async () => {
      // Arrange
      const bookingMinimal = buildBooking({
        bookingCode: undefined as unknown as string,
        id: 'bk-fallback',
        startTime: undefined as unknown as string,
        endTime: undefined as unknown as string,
        doctor: null,
        service: null,
      });
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([bookingMinimal]);

      // Act
      await service.sendTomorrowReminders();

      // Assert
      expect(notificationsService.sendBookingReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'bk-fallback', // fallback to id when code is missing
          doctorName: 'Bác sĩ',
          serviceName: 'Khám tổng quát',
          startTime: '',
          endTime: '',
          duration: 30,
        }),
      );
    });

    it('should not throw and log error if repository throws', async () => {
      // Arrange
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockRejectedValue(new Error('DB connection lost'));

      // Act & Assert: should NOT throw — error is caught internally
      await expect(service.sendTomorrowReminders()).resolves.toBeUndefined();
      expect(notificationsService.sendBookingReminder).not.toHaveBeenCalled();
    });
  });

  describe('sendOneHourReminders', () => {
    it('should only send reminders for bookings whose startTime matches the target hour', async () => {
      // Arrange — mock the "1 hour from now" scenario
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const targetHour = oneHourLater.getHours().toString().padStart(2, '0');
      const otherHour =
        oneHourLater.getHours() === 23
          ? '00'
          : String(oneHourLater.getHours() + 1).padStart(2, '0');

      const matchingBooking = buildBooking({ startTime: `${targetHour}:00` });
      const nonMatchingBooking = buildBooking({
        id: 'b2',
        bookingCode: 'BK002',
        startTime: `${otherHour}:00`,
      });

      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([matchingBooking, nonMatchingBooking]);

      // Act
      await service.sendOneHourReminders();

      // Assert — only the matching booking should get a reminder
      expect(notificationsService.sendBookingReminder).toHaveBeenCalledTimes(1);
      expect(notificationsService.sendBookingReminder).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: `${targetHour}:00` }),
      );
    });

    it('should skip bookings without startTime during 1-hour reminder', async () => {
      // Arrange
      const bookingNoTime = buildBooking({
        startTime: undefined as unknown as string,
      });
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockResolvedValue([bookingNoTime]);

      // Act
      await service.sendOneHourReminders();

      // Assert
      expect(notificationsService.sendBookingReminder).not.toHaveBeenCalled();
    });

    it('should not throw if 1h reminder repository call fails', async () => {
      // Arrange
      (
        bookingRepository.findConfirmedBookingsInTimeRange as jest.Mock
      ).mockRejectedValue(new Error('Timeout'));

      // Act & Assert
      await expect(service.sendOneHourReminders()).resolves.toBeUndefined();
    });
  });
});
