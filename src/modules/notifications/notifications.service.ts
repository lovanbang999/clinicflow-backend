import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType, NotificationChannel, Prisma } from '@prisma/client';

interface BookingEmailData {
  bookingId: string;
  patientId?: string; // Added to link in-app notification
  patientName: string;
  patientEmail: string;
  doctorName: string;
  serviceName: string;
  bookingDate: string;
  startTime?: string | null;
  endTime?: string | null;
  duration: number;
  status: string;
  price?: number;
  patientNotes?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  diagnosisName?: string;
  hasPrescription?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private layoutTemplate: HandlebarsTemplateDelegate;
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {
    this.loadTemplates();
  }

  /**
   * Create and send an in-app notification
   */
  async createInAppNotification(data: {
    userId: string;
    title: string;
    content: string;
    type: NotificationType;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          content: data.content,
          type: data.type,
          channel: NotificationChannel.IN_APP,
          metadata: data.metadata ?? Prisma.JsonNull,
        },
      });

      // Send via WebSocket if user is connected
      this.gateway.sendToUser(data.userId, notification);

      return notification;
    } catch (error) {
      this.logger.error('Failed to create in-app notification:', error);
      throw error;
    }
  }

  /**
   * Get user's in-app notifications
   */
  async getMyNotifications(userId: string) {
    const list = await this.prisma.notification.findMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        isRead: false,
      },
    });

    return { notifications: list, unreadCount };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, id: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false, channel: NotificationChannel.IN_APP },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Load and compile Handlebars templates
   */
  private loadTemplates() {
    try {
      const templatesDir = path.join(
        process.cwd(),
        'src/modules/notifications/templates',
      );

      // Load layout
      const layoutPath = path.join(templatesDir, 'layout.hbs');
      if (fs.existsSync(layoutPath)) {
        this.layoutTemplate = Handlebars.compile(
          fs.readFileSync(layoutPath, 'utf-8'),
        );
      }

      // Load all body templates
      const templateFiles = [
        'booking-confirmation',
        'booking-cancellation',
        'booking-reminder',
        'post-visit',
        'invoice',
        'queue-promotion',
      ];

      for (const t of templateFiles) {
        const tPath = path.join(templatesDir, `${t}.hbs`);
        if (fs.existsSync(tPath)) {
          this.templates[t] = Handlebars.compile(
            fs.readFileSync(tPath, 'utf-8'),
          );
        }
      }

      this.logger.log('Notification email templates loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load email templates:', error);
    }
  }

  /**
   * Helper to compile template with layout
   */
  private compile(templateName: string, data: any): string {
    const bodyTemplate = this.templates[templateName];
    if (!bodyTemplate || !this.layoutTemplate) {
      this.logger.error(`Template ${templateName} or layout not found`);
      return '';
    }
    const bodyHtml = bodyTemplate(data);
    return this.layoutTemplate({ ...data, body: bodyHtml });
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: BookingEmailData): Promise<void> {
    try {
      const isPending = data.status === 'PENDING';
      const isQueued = data.status === 'QUEUED' || !data.startTime;

      const subject = isPending
        ? '📅 Lịch hẹn mới đang được xử lý - Smart Clinic'
        : '✅ Xác nhận lịch hẹn thành công - Smart Clinic';

      const html = this.compile('booking-confirmation', {
        ...data,
        isQueued,
        isPending,
        subject,
        subheader: 'Xác nhận đặt lịch',
      });

      await this.mailService.sendMail(data.patientEmail, subject, html);
      this.logger.log(
        `Booking confirmation email sent to ${data.patientEmail}`,
      );

      // Trigger in-app notification
      if (data.patientId) {
        await this.createInAppNotification({
          userId: data.patientId,
          title: isPending ? 'Lịch hẹn đang xử lý' : 'Lịch hẹn đã xác nhận',
          content: isPending
            ? `Lịch hẹn khám ${data.serviceName} của bạn đang được hệ thống xử lý.`
            : `Lịch hẹn khám ${data.serviceName} của bạn đã được xác nhận thành công.`,
          type: NotificationType.BOOKING_CONFIRMED,
          metadata: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send booking confirmation email:', error);
    }
  }

  /**
   * Send queue promotion notification
   */
  async sendQueuePromotion(data: BookingEmailData): Promise<void> {
    try {
      const subject = '🎉 Lịch hẹn của bạn đã được xác nhận! - Smart Clinic';
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const myBookingsUrl = `${frontendUrl}/patient/bookings`;

      const html = this.compile('queue-promotion', {
        ...data,
        myBookingsUrl,
        subject,
        subheader: 'Thông báo xác nhận lịch',
      });

      await this.mailService.sendMail(data.patientEmail, subject, html);
      this.logger.log(`Queue promotion email sent to ${data.patientEmail}`);

      // Trigger in-app notification
      if (data.patientId) {
        await this.createInAppNotification({
          userId: data.patientId,
          title: 'Lịch hẹn đã được xác nhận',
          content: `Lịch hẹn khám ${data.serviceName} của bạn đã được chuyển từ hàng đợi sang xác nhận.`,
          type: NotificationType.BOOKING_CONFIRMED,
          metadata: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send queue promotion email:', error);
    }
  }

  /**
   * Send booking cancellation notification
   */
  async sendBookingCancellation(data: BookingEmailData): Promise<void> {
    try {
      const subject = '❌ Thông báo hủy lịch hẹn - Smart Clinic';
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const rebookUrl = `${frontendUrl}/booking`;

      const html = this.compile('booking-cancellation', {
        ...data,
        rebookUrl,
        subject,
        subheader: 'Hủy lịch hẹn',
      });

      await this.mailService.sendMail(data.patientEmail, subject, html);
      this.logger.log(
        `Booking cancellation email sent to ${data.patientEmail}`,
      );

      // Trigger in-app notification
      if (data.patientId) {
        await this.createInAppNotification({
          userId: data.patientId,
          title: 'Lịch hẹn đã bị hủy',
          content: `Lịch hẹn khám ${data.serviceName} vào ngày ${data.bookingDate} đã bị hủy.`,
          type: NotificationType.BOOKING_CANCELLED,
          metadata: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send booking cancellation email:', error);
    }
  }

  /**
   * Send booking reminder (24 hours before)
   */
  async sendBookingReminder(data: BookingEmailData): Promise<void> {
    try {
      const subject =
        '⏰ Nhắc hẹn: Lịch khám của bạn vào ngày mai - Smart Clinic';

      const html = this.compile('booking-reminder', {
        ...data,
        subject,
        subheader: 'Nhắc lịch khám bệnh',
      });

      await this.mailService.sendMail(data.patientEmail, subject, html);
      this.logger.log(`Booking reminder email sent to ${data.patientEmail}`);

      // Trigger in-app notification
      if (data.patientId) {
        await this.createInAppNotification({
          userId: data.patientId,
          title: 'Nhắc nhở lịch khám',
          content: `Bạn có lịch khám ${data.serviceName} vào ngày mai. Đừng quên nhé!`,
          type: NotificationType.APPOINTMENT_REMINDER,
          metadata: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send booking reminder email:', error);
    }
  }

  /**
   * Send post-visit email (Thank you + Prescription notification)
   */
  async sendPostVisitEmail(data: BookingEmailData): Promise<void> {
    try {
      const subject = data.hasPrescription
        ? '💊 Đơn thuốc của bạn đã sẵn sàng - Smart Clinic'
        : '✅ Hoàn tất buổi thăm khám - Smart Clinic';

      const html = this.compile('post-visit', {
        ...data,
        subject,
        subheader: 'Kết quả thăm khám',
      });

      await this.mailService.sendMail(data.patientEmail, subject, html);
      this.logger.log(`Post-visit email sent to ${data.patientEmail}`);

      // Trigger in-app notification
      if (data.patientId) {
        await this.createInAppNotification({
          userId: data.patientId,
          title: data.hasPrescription
            ? 'Đơn thuốc sẵn sàng'
            : 'Thăm khám hoàn tất',
          content: data.hasPrescription
            ? `Đơn thuốc cho buổi khám ${data.serviceName} đã sẵn sàng. Vui lòng kiểm tra.`
            : `Cảm ơn bạn đã tin tưởng Smart Clinic. Buổi thăm khám ${data.serviceName} đã hoàn tất.`,
          type: data.hasPrescription
            ? NotificationType.LAB_RESULT_READY
            : NotificationType.SYSTEM,
          metadata: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send post-visit email:', error);
    }
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(data: {
    patientId?: string; // Added to link in-app notification
    patientName: string;
    patientEmail: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceType: string;
    totalAmount: string;
    invoiceUrl: string;
  }): Promise<void> {
    try {
      const subject = `🧾 Hóa đơn thanh toán ${data.invoiceNumber} - Smart Clinic`;

      const html = this.compile('invoice', {
        ...data,
        subject,
        subheader: 'Hóa đơn dịch vụ',
      });

      await this.mailService.sendMail(data.patientEmail, subject, html);
      this.logger.log(`Invoice email sent to ${data.patientEmail}`);

      // Trigger in-app notification
      if (data.patientId) {
        await this.createInAppNotification({
          userId: data.patientId,
          title: 'Hóa đơn mới',
          content: `Hóa đơn ${data.invoiceNumber} cho dịch vụ ${data.invoiceType} đã được phát hành.`,
          type: NotificationType.INVOICE_ISSUED,
          metadata: { invoiceNumber: data.invoiceNumber },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send invoice email:', error);
    }
  }
}
