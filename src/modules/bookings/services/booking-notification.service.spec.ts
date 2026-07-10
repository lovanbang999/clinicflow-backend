import { BookingNotificationService } from './booking-notification.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BookingStatus } from '@prisma/client';

type MockNotificationsService = {
  [K in keyof NotificationsService]: jest.Mock;
};

function makeMockNotificationsService(): MockNotificationsService {
  return {
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
    notifyAdmins: jest.fn().mockResolvedValue(undefined),
    notifyReceptionists: jest.fn().mockResolvedValue(undefined),
  } as unknown as MockNotificationsService;
}

function makeBooking(
  overrides: Partial<{
    id: string;
    bookingCode: string;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    status: BookingStatus;
    patientNotes: string | null;
    serviceId: string;
    patientProfile: {
      email: string | null;
      userId: string | null;
      fullName: string;
    };
    doctor: { fullName: string };
    service: { name: string; durationMinutes: number; price: number } | null;
  }> = {},
) {
  return {
    id: 'booking-1',
    bookingCode: 'BK-001',
    bookingDate: new Date('2026-07-15'),
    startTime: '09:00',
    endTime: '09:30',
    status: BookingStatus.CONFIRMED,
    patientNotes: null,
    serviceId: 'svc-1',
    patientProfile: {
      email: 'patient@test.com',
      userId: 'user-1',
      fullName: 'Nguyen Van A',
    },
    doctor: { fullName: 'Dr. Smith' },
    service: { name: 'General Checkup', durationMinutes: 30, price: 200000 },
    ...overrides,
  };
}

describe('BookingNotificationService', () => {
  let service: BookingNotificationService;
  let mockNotifications: MockNotificationsService;

  beforeEach(() => {
    mockNotifications = makeMockNotificationsService();
    service = new BookingNotificationService(mockNotifications as never);
  });

  describe('sendBookingNotification', () => {
    it('should call sendBookingConfirmation with correct payload', async () => {
      const booking = makeBooking();

      await service.sendBookingNotification(booking as never);

      expect(mockNotifications.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          patientEmail: 'patient@test.com',
          doctorName: 'Dr. Smith',
          serviceName: 'General Checkup',
          status: BookingStatus.CONFIRMED,
        }),
      );
    });

    it('should skip sending if patientProfile.email is null', async () => {
      const booking = makeBooking({
        patientProfile: { email: null, userId: 'u-1', fullName: 'A' },
      });

      await service.sendBookingNotification(booking as never);

      expect(mockNotifications.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('should use fallback service name if service is null', async () => {
      const booking = makeBooking({ service: null });

      await service.sendBookingNotification(booking as never);

      expect(mockNotifications.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ serviceName: 'Tư vấn (Chưa xác định)' }),
      );
    });

    it('should swallow errors from notificationsService', async () => {
      mockNotifications.sendBookingConfirmation.mockRejectedValue(
        new Error('SMTP failed'),
      );
      const booking = makeBooking();

      await expect(
        service.sendBookingNotification(booking as never),
      ).resolves.not.toThrow();
    });
  });

  describe('sendCancellationNotification', () => {
    it('should call sendBookingCancellation with correct payload', async () => {
      const booking = makeBooking({ status: BookingStatus.CANCELLED });

      await service.sendCancellationNotification(booking as never);

      expect(mockNotifications.sendBookingCancellation).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          patientEmail: 'patient@test.com',
          doctorName: 'Dr. Smith',
          status: BookingStatus.CANCELLED,
        }),
      );
    });

    it('should skip if email is null', async () => {
      const booking = makeBooking({
        patientProfile: { email: null, userId: 'u-1', fullName: 'A' },
      });

      await service.sendCancellationNotification(booking as never);

      expect(mockNotifications.sendBookingCancellation).not.toHaveBeenCalled();
    });

    it('should swallow errors from notificationsService', async () => {
      mockNotifications.sendBookingCancellation.mockRejectedValue(
        new Error('Network error'),
      );
      const booking = makeBooking();

      await expect(
        service.sendCancellationNotification(booking as never),
      ).resolves.not.toThrow();
    });
  });

  describe('notifyAdminsOfBooking', () => {
    it('should notify admins with CREATED action', async () => {
      const booking = makeBooking();

      await service.notifyAdminsOfBooking(booking as never, 'CREATED');

      expect(mockNotifications.notifyAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Lịch hẹn mới',
          metadata: { bookingId: 'booking-1', status: BookingStatus.CONFIRMED },
        }),
      );
    });

    it('should notify admins with UPDATED action', async () => {
      const booking = makeBooking({ status: BookingStatus.IN_PROGRESS });

      await service.notifyAdminsOfBooking(booking as never, 'UPDATED');

      expect(mockNotifications.notifyAdmins).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cập nhật lịch hẹn' }),
      );
    });

    it('should notify admins with CANCELLED action and extraInfo', async () => {
      const booking = makeBooking({ status: BookingStatus.CANCELLED });

      await service.notifyAdminsOfBooking(
        booking as never,
        'CANCELLED',
        'Patient no-show',
      );

      expect(mockNotifications.notifyAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Lịch hẹn đã hủy',
          content: expect.stringContaining('Patient no-show') as string,
        }),
      );
    });
  });

  describe('notifyReceptionistsOfPayment', () => {
    it('should call notifyReceptionists with correct payload', async () => {
      const booking = makeBooking();

      await service.notifyReceptionistsOfPayment(booking as never, 'X-Ray');

      expect(mockNotifications.notifyReceptionists).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Chờ thanh toán & Khám chuyên khoa',
          content: expect.stringContaining('X-Ray') as string,
          metadata: expect.objectContaining({
            bookingId: 'booking-1',
            type: 'PAYMENT_REQUIRED',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('sendStatusSpecificNotification', () => {
    it('should call sendBookingConfirmation when status is CONFIRMED', async () => {
      const booking = makeBooking({ status: BookingStatus.CONFIRMED });

      await service.sendStatusSpecificNotification(booking as never);

      expect(mockNotifications.sendBookingConfirmation).toHaveBeenCalled();
    });

    it('should skip if status is not CONFIRMED', async () => {
      const booking = makeBooking({ status: BookingStatus.PENDING });

      await service.sendStatusSpecificNotification(booking as never);

      expect(mockNotifications.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('should skip if email is missing', async () => {
      const booking = makeBooking({
        status: BookingStatus.CONFIRMED,
        patientProfile: { email: null, userId: 'u-1', fullName: 'A' },
      });

      await service.sendStatusSpecificNotification(booking as never);

      expect(mockNotifications.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('should swallow errors without rethrowing', async () => {
      mockNotifications.sendBookingConfirmation.mockRejectedValue(
        new Error('fail'),
      );
      const booking = makeBooking({ status: BookingStatus.CONFIRMED });

      await expect(
        service.sendStatusSpecificNotification(booking as never),
      ).resolves.not.toThrow();
    });
  });
});
