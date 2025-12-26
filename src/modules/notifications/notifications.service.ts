import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';
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
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  price?: number;
  patientNotes?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private bookingConfirmationTemplate: HandlebarsTemplateDelegate;
  private queuePromotionTemplate: HandlebarsTemplateDelegate;

  constructor(private readonly mailService: MailService) {
    this.loadTemplates();
  }

  /**
   * Load and compile Handlebars templates
   */
  private loadTemplates() {
    try {
      const templatesDir = path.join(
        __dirname,
        '..',
        '..',
        'modules',
        'notifications',
        'templates',
      );

      // Load booking confirmation template
      const bookingConfirmationPath = path.join(
        templatesDir,
        'booking-confirmation.hbs',
      );
      const bookingConfirmationSource = fs.readFileSync(
        bookingConfirmationPath,
        'utf-8',
      );
      this.bookingConfirmationTemplate = Handlebars.compile(
        bookingConfirmationSource,
      );

      // Load queue promotion template
      const queuePromotionPath = path.join(templatesDir, 'queue-promotion.hbs');
      const queuePromotionSource = fs.readFileSync(queuePromotionPath, 'utf-8');
      this.queuePromotionTemplate = Handlebars.compile(queuePromotionSource);

      this.logger.log('Email templates loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load email templates:', error);
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: BookingEmailData): Promise<void> {
    try {
      const isQueued = data.status === 'QUEUED';
      const isPending = data.status === 'PENDING';

      const html = this.bookingConfirmationTemplate({
        ...data,
        isQueued,
        isPending,
        statusClass: this.getStatusClass(data.status),
      });

      const subject = isQueued
        ? '⏳ Your Booking is in Queue - Smart Clinic'
        : isPending
          ? '📅 Booking Scheduled - Smart Clinic'
          : '✅ Booking Confirmed - Smart Clinic';

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
      const html = this.queuePromotionTemplate(data);

      const subject = '🎉 Your Appointment is Confirmed! - Smart Clinic';

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
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .booking-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏥 Smart Clinic</h1>
                <p>Booking Cancellation</p>
              </div>
              <div class="content">
                <h2>Hello ${data.patientName},</h2>
                <p>Your appointment has been cancelled.</p>
                
                <div class="booking-card">
                  <h3>📋 Cancelled Booking Details</h3>
                  <p><strong>Booking ID:</strong> ${data.bookingId}</p>
                  <p><strong>Doctor:</strong> ${data.doctorName}</p>
                  <p><strong>Service:</strong> ${data.serviceName}</p>
                  <p><strong>Date:</strong> ${data.bookingDate}</p>
                  <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
                </div>
                
                <p>If you did not request this cancellation or have any questions, please contact us immediately.</p>
                <p>We hope to serve you again soon!</p>
                
                <p>Best regards,<br>Smart Clinic Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; 2025 Smart Clinic. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const subject = '❌ Booking Cancelled - Smart Clinic';

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
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .booking-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏥 Smart Clinic</h1>
                <p>Appointment Reminder</p>
              </div>
              <div class="content">
                <h2>Hello ${data.patientName}! 👋</h2>
                <p><strong>This is a friendly reminder about your upcoming appointment tomorrow.</strong></p>
                
                <div class="booking-card">
                  <h3>📋 Appointment Details</h3>
                  <p><strong>Doctor:</strong> ${data.doctorName}</p>
                  <p><strong>Service:</strong> ${data.serviceName}</p>
                  <p><strong>Date:</strong> ${data.bookingDate}</p>
                  <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
                </div>
                
                <div class="alert">
                  <strong>📌 Please Remember:</strong>
                  <ul>
                    <li>Arrive 10 minutes early</li>
                    <li>Bring your ID and medical documents</li>
                    <li>If you need to cancel, please do so ASAP</li>
                  </ul>
                </div>
                
                <p>We look forward to seeing you!</p>
                
                <p>Best regards,<br>Smart Clinic Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; 2025 Smart Clinic. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const subject = '⏰ Appointment Reminder - Tomorrow - Smart Clinic';

      await this.mailService.sendMail(data.patientEmail, subject, html);

      this.logger.log(`Booking reminder email sent to ${data.patientEmail}`);
    } catch (error) {
      this.logger.error('Failed to send booking reminder email:', error);
    }
  }

  /**
   * Get status CSS class
   */
  private getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      QUEUED: 'queued',
      CHECKED_IN: 'confirmed',
      IN_PROGRESS: 'confirmed',
      COMPLETED: 'confirmed',
      CANCELLED: 'pending',
      NO_SHOW: 'pending',
    };

    return statusMap[status] || 'pending';
  }
}
