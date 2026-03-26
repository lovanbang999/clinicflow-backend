import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

interface BookingEmailData {
  bookingId: string;
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
  ) {
    this.loadTemplates();
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
    } catch (error) {
      this.logger.error('Failed to send post-visit email:', error);
    }
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(data: {
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
    } catch (error) {
      this.logger.error('Failed to send invoice email:', error);
    }
  }
}
