import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { I_SYSTEM_REPOSITORY } from '../database/interfaces/system.repository.interface';
import { I_USER_REPOSITORY } from '../database/interfaces/user.repository.interface';
import { NotificationType, UserRole } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mailServiceMock: Record<string, jest.Mock>;
  let configServiceMock: Record<string, jest.Mock>;
  let systemRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;
  let gatewayMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    mailServiceMock = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    configServiceMock = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'FRONTEND_URL') return 'http://localhost:3000';
          return defaultValue;
        }),
    };

    systemRepositoryMock = {
      createNotification: jest.fn(),
      findUserInAppNotifications: jest.fn(),
      countUnreadInAppNotifications: jest.fn(),
      markNotificationAsRead: jest.fn(),
      markAllNotificationsAsRead: jest.fn(),
    };

    userRepositoryMock = {
      findActiveUserIdsByRole: jest.fn(),
    };

    gatewayMock = {
      sendToUser: jest.fn(),
      broadcastToRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: MailService, useValue: mailServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: I_SYSTEM_REPOSITORY, useValue: systemRepositoryMock },
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: NotificationsGateway, useValue: gatewayMock },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('createInAppNotification', () => {
    it('should create a notification in system repository and send via gateway', async () => {
      const mockNotif = { id: 'notif-1', title: 'Hello', content: 'World' };
      systemRepositoryMock.createNotification.mockResolvedValue(mockNotif);

      const result = await service.createInAppNotification({
        userId: 'user-1',
        title: 'Hello',
        content: 'World',
        type: NotificationType.SYSTEM,
      });

      expect(result).toEqual(mockNotif);
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
      expect(gatewayMock.sendToUser).toHaveBeenCalledWith('user-1', mockNotif);
    });

    it('should throw error and log if createNotification fails', async () => {
      systemRepositoryMock.createNotification.mockRejectedValue(
        new Error('DB Error'),
      );

      await expect(
        service.createInAppNotification({
          userId: 'user-1',
          title: 'Hello',
          content: 'World',
          type: NotificationType.SYSTEM,
        }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('notifyRole', () => {
    it('should notify all active users with the role and broadcast to role room', async () => {
      userRepositoryMock.findActiveUserIdsByRole.mockResolvedValue([
        'user-1',
        'user-2',
      ]);
      const mockNotif = { id: 'notif-1', title: 'Hello', content: 'World' };
      systemRepositoryMock.createNotification.mockResolvedValue(mockNotif);

      const result = await service.notifyRole({
        role: UserRole.TECHNICIAN,
        title: 'Hello',
        content: 'World',
        type: NotificationType.SYSTEM,
      });

      expect(result?.length).toBe(2);
      expect(gatewayMock.broadcastToRole).toHaveBeenCalledWith(
        UserRole.TECHNICIAN,
        expect.objectContaining({ title: 'Hello' }),
      );
    });
  });

  describe('getMyNotifications', () => {
    it('should return user notifications and unread count', async () => {
      systemRepositoryMock.findUserInAppNotifications.mockResolvedValue([
        { id: 'notif-1' },
      ]);
      systemRepositoryMock.countUnreadInAppNotifications.mockResolvedValue(1);

      const result = await service.getMyNotifications('user-1');
      expect(result.notifications).toEqual([{ id: 'notif-1' }]);
      expect(result.unreadCount).toBe(1);
    });
  });

  describe('markAsRead & markAllAsRead', () => {
    it('should mark notification as read', async () => {
      systemRepositoryMock.markNotificationAsRead.mockResolvedValue({
        id: 'notif-1',
        isRead: true,
      });
      const result = await service.markAsRead('user-1', 'notif-1');
      expect(result.isRead).toBe(true);
      expect(systemRepositoryMock.markNotificationAsRead).toHaveBeenCalledWith(
        'notif-1',
        'user-1',
      );
    });

    it('should mark all notifications as read', async () => {
      systemRepositoryMock.markAllNotificationsAsRead.mockResolvedValue({
        count: 5,
      });
      const result = await service.markAllAsRead('user-1');
      expect(result.count).toBe(5);
      expect(
        systemRepositoryMock.markAllNotificationsAsRead,
      ).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Email Notification Methods', () => {
    const mockEmailData = {
      bookingId: 'booking-1',
      patientId: 'patient-1',
      patientName: 'Test Patient',
      patientEmail: 'patient@example.com',
      doctorName: 'Doctor Strange',
      serviceName: 'General Consultation',
      bookingDate: '2026-07-10',
      duration: 30,
      status: 'CONFIRMED',
    };

    it('should send booking confirmation email and trigger in-app notification', async () => {
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.sendBookingConfirmation(mockEmailData);

      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        'patient@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
    });

    it('should send queue promotion email and trigger in-app notification', async () => {
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.sendQueuePromotion(mockEmailData);

      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        'patient@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
    });

    it('should send booking cancellation email and trigger in-app notification', async () => {
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.sendBookingCancellation(mockEmailData);

      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        'patient@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
    });

    it('should send booking reminder email and trigger in-app notification', async () => {
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.sendBookingReminder(mockEmailData);

      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        'patient@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
    });

    it('should send post-visit email and trigger in-app notification', async () => {
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.sendPostVisitEmail({
        ...mockEmailData,
        hasPrescription: true,
      });

      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        'patient@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
    });

    it('should send invoice email and trigger in-app notification', async () => {
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.sendInvoiceEmail({
        patientId: 'patient-1',
        patientName: 'Test Patient',
        patientEmail: 'patient@example.com',
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-07-10',
        invoiceType: 'LAB',
        totalAmount: '500,000 VND',
        invoiceUrl: 'http://localhost:3000/invoice/1',
      });

      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        'patient@example.com',
        expect.any(String),
        expect.any(String),
      );
      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
    });
  });

  describe('notifyAdmins & notifyReceptionists', () => {
    it('should notify admins successfully and emit via gateway', async () => {
      userRepositoryMock.findActiveUserIdsByRole.mockResolvedValue(['admin-1']);
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.notifyAdmins({
        title: 'New Event',
        content: 'Something happened',
      });

      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
      expect(gatewayMock.sendToUser).toHaveBeenCalledWith('admin-1', {
        id: 'notif-1',
      });
    });

    it('should return early if no admins found', async () => {
      userRepositoryMock.findActiveUserIdsByRole.mockResolvedValue([]);

      await service.notifyAdmins({
        title: 'New Event',
        content: 'Something happened',
      });

      expect(systemRepositoryMock.createNotification).not.toHaveBeenCalled();
    });

    it('should notify receptionists successfully and emit via gateway', async () => {
      userRepositoryMock.findActiveUserIdsByRole.mockResolvedValue([
        'receptionist-1',
      ]);
      systemRepositoryMock.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await service.notifyReceptionists({
        title: 'New Ticket',
        content: 'Please check',
      });

      expect(systemRepositoryMock.createNotification).toHaveBeenCalled();
      expect(gatewayMock.sendToUser).toHaveBeenCalledWith('receptionist-1', {
        id: 'notif-1',
      });
    });
  });
});
