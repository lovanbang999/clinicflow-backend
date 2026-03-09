import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter() {
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = this.configService.get<number>('MAIL_PORT');
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPassword = this.configService.get<string>('MAIL_PASSWORD');

    // If email config is not set, use console logging only
    if (!mailHost || !mailUser || !mailPassword) {
      this.logger.warn(
        'Email configuration not found. Emails will be logged to console only.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: false, // true for 465, false for other ports
      auth: {
        user: mailUser,
        pass: mailPassword,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('Email transporter verification failed:', error);
      } else {
        this.logger.log('Email transporter is ready to send emails');
      }
    });
  }

  /**
   * Send verification email with OTP code
   */
  async sendVerificationEmail(
    email: string,
    fullName: string,
    code: string,
  ): Promise<void> {
    const subject = 'Verify Your Email - Smart Clinic';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #667eea; margin: 20px 0; border-radius: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 Smart Clinic</h1>
              <p>Email Verification</p>
            </div>
            <div class="content">
              <h2>Hello ${fullName}! 👋</h2>
              <p>Thank you for registering with Smart Clinic. To complete your registration, please use the verification code below:</p>
              
              <div class="otp-code">${code}</div>
              
              <p><strong>This code will expire in 15 minutes.</strong></p>
              
              <p>If you didn't request this verification, please ignore this email.</p>
              
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

    await this.sendMail(email, subject, html, fullName, code);
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const subject = 'Welcome to Smart Clinic! 🎉';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 Welcome to Smart Clinic!</h1>
            </div>
            <div class="content">
              <h2>Hello ${fullName}! 🎉</h2>
              <p>Your account has been successfully verified. You can now enjoy all the features of Smart Clinic:</p>
              
              <div class="feature">
                <strong>📅 Smart Booking</strong><br>
                Book appointments with ease using our intelligent scheduling system
              </div>
              
              <div class="feature">
                <strong>⏱️ Queue Management</strong><br>
                Track your position in the queue in real-time
              </div>
              
              <div class="feature">
                <strong>👨‍⚕️ Doctor Selection</strong><br>
                Choose from our experienced medical professionals
              </div>
              
              <div class="feature">
                <strong>📱 Notifications</strong><br>
                Get notified about appointments and queue updates
              </div>
              
              <p>Thank you for choosing Smart Clinic. We look forward to serving you!</p>
              
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

    await this.sendMail(email, subject, html, fullName);
  }

  /**
   * Public method to send email (for NotificationsService)
   */
  async sendMail(
    to: string,
    subject: string,
    html: string,
    fullName?: string,
    code?: string,
  ): Promise<void> {
    try {
      // If transporter is not initialized, just log
      if (!this.transporter) {
        this.logger.log(`
          ═══════════════════════════════════════
          📧 EMAIL (Console Mode)
          ═══════════════════════════════════════
          To: ${to}
          Subject: ${subject}
          ${fullName ? `Name: ${fullName}` : ''}
          ${code ? `OTP Code: ${code}` : ''}
          ═══════════════════════════════════════
        `);
        return;
      }

      const mailFrom = this.configService.get<string>('MAIL_FROM');

      await this.transporter.sendMail({
        from: mailFrom,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      // Fallback to console logging
      this.logger.log(`
        ═══════════════════════════════════════
        📧 EMAIL (Fallback Mode)
        ═══════════════════════════════════════
        To: ${to}
        Subject: ${subject}
        ${fullName ? `Name: ${fullName}` : ''}
        ${code ? `OTP Code: ${code}` : ''}
        ═══════════════════════════════════════
      `);
    }
  }
}
