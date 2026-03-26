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
  startTime?: string | null; // null/undefined for walk-in bookings
  endTime?: string | null; // null/undefined for walk-in bookings
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
      const templatesDir = path.join(__dirname, 'templates');

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
      this.logger.warn(
        'Email notifications will not be sent with custom templates',
      );
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: BookingEmailData): Promise<void> {
    try {
      // Note: QUEUED status is deprecated — booking flow now uses PENDING → CONFIRMED
      const isPending = data.status === 'PENDING';
      const isQueued = false; // kept for template backward compat

      const html = this.bookingConfirmationTemplate({
        ...data,
        isQueued,
        isPending,
        statusClass: this.getStatusClass(data.status),
      });

      const subject = isPending
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
   * Send post-visit email (Thank you + Prescription notification)
   */
  async sendPostVisitEmail(data: BookingEmailData): Promise<void> {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .booking-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
              .prescription-alert { background: #e0e7ff; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏥 Smart Clinic</h1>
                <p>Visit Completed</p>
              </div>
              <div class="content">
                <h2>Hello ${data.patientName}! 👋</h2>
                <p>Thank you for visiting Smart Clinic today. Your consultation with <strong>Dr. ${data.doctorName}</strong> has been completed.</p>
                
                <div class="booking-card">
                  <h3>📋 Visit Summary</h3>
                  <p><strong>Date:</strong> ${data.bookingDate}</p>
                  <p><strong>Service:</strong> ${data.serviceName}</p>
                  ${data.diagnosisName ? `<p><strong>Diagnosis:</strong> ${data.diagnosisName}</p>` : ''}
                </div>
                
                ${
                  data.hasPrescription
                    ? `
                <div class="prescription-alert">
                  <strong>💊 Prescription Available</strong>
                  <p>Dr. ${data.doctorName} has prescribed medication for you. Please proceed to the <strong>Pharmacy / Reception desk</strong> to collect your medication and complete the pharmacy payment.</p>
                </div>
                `
                    : ''
                }
                
                <p>We wish you good health and a speedy recovery!</p>
                
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

      const subject = data.hasPrescription
        ? '💊 Your Prescription is Ready - Smart Clinic'
        : '✅ Visit Completed - Smart Clinic';

      await this.mailService.sendMail(data.patientEmail, subject, html);

      this.logger.log(`Post-visit email sent to ${data.patientEmail}`);
    } catch (error) {
      this.logger.error('Failed to send post-visit email:', error);
    }
  }

  /**
   * Get status CSS class
   */
  private getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      CHECKED_IN: 'confirmed',
      IN_PROGRESS: 'confirmed',
      COMPLETED: 'confirmed',
      CANCELLED: 'pending',
      NO_SHOW: 'pending',
    };

    return statusMap[status] || 'pending';
  }
}
