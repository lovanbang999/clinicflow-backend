import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private layoutTemplate: HandlebarsTemplateDelegate;
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
    this.loadTemplates();
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

    this.transporter = createTransport({
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
   * Load and compile templates
   */
  private loadTemplates() {
    try {
      // Use process.cwd() or similar to ensure we find templates in different environments
      const templatesDir = path.join(
        process.cwd(),
        'src/modules/notifications/templates',
      );

      const layoutPath = path.join(templatesDir, 'layout.hbs');
      if (fs.existsSync(layoutPath)) {
        this.layoutTemplate = Handlebars.compile(
          fs.readFileSync(layoutPath, 'utf-8'),
        );
      }

      const authTemplates = ['verification', 'password-reset', 'welcome'];
      for (const t of authTemplates) {
        const tPath = path.join(templatesDir, `${t}.hbs`);
        if (fs.existsSync(tPath)) {
          this.templates[t] = Handlebars.compile(
            fs.readFileSync(tPath, 'utf-8'),
          );
        }
      }
      this.logger.log('Auth email templates loaded successfully');
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
   * Send verification email with OTP code
   */
  async sendVerificationEmail(
    email: string,
    fullName: string,
    code: string,
  ): Promise<void> {
    const subject = 'Mã xác nhận đăng ký - Smart Clinic';
    const html = this.compile('verification', {
      fullName,
      code,
      subject,
      subheader: 'Xác thực tài khoản',
    });

    await this.sendMail(email, subject, html, fullName, code);
  }

  /**
   * Send password reset email with OTP code
   */
  async sendPasswordResetEmail(
    email: string,
    fullName: string,
    code: string,
  ): Promise<void> {
    const subject = 'Yêu cầu khôi phục mật khẩu - Smart Clinic';
    const html = this.compile('password-reset', {
      fullName,
      code,
      subject,
      subheader: 'Khôi phục mật khẩu',
    });

    await this.sendMail(email, subject, html, fullName, code);
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const subject = 'Chào mừng bạn đến với Smart Clinic! 🎉';
    const loginUrl = `${this.configService.get('FRONTEND_URL')}/login`;
    const html = this.compile('welcome', {
      fullName,
      loginUrl,
      subject,
      subheader: 'Bắt đầu hành trình sức khỏe',
    });

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
