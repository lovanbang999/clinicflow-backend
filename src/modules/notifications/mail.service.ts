import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

type MailProvider = 'nodemailer' | 'resend' | 'console';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private provider: MailProvider = 'console';
  private transporter?: Transporter;
  private resend?: Resend;
  private layoutTemplate: HandlebarsTemplateDelegate;
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(private configService: ConfigService) {
    this.initializeMailer();
    this.loadTemplates();
  }

  /**
   * Initialize email provider based on runtime environment.
   */
  private initializeMailer() {
    const nodeEnv =
      this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;

    if (nodeEnv === 'production') {
      this.initializeResend();
      return;
    }

    this.initializeNodemailer();
  }

  /**
   * Initialize Resend for production.
   */
  private initializeResend() {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!resendApiKey) {
      this.logger.warn(
        'RESEND_API_KEY not found. Production emails will be logged to console only.',
      );
      this.provider = 'console';
      return;
    }

    this.resend = new Resend(resendApiKey);
    this.provider = 'resend';
    this.logger.log('Resend email provider is ready to send emails');
  }

  /**
   * Initialize Nodemailer for non-production environments.
   */
  private initializeNodemailer() {
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = this.configService.get<number>('MAIL_PORT');
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPassword = this.configService.get<string>('MAIL_PASSWORD');

    // If email config is not set, use console logging only
    if (!mailHost || !mailUser || !mailPassword) {
      this.logger.warn(
        'Nodemailer configuration not found. Emails will be logged to console only.',
      );
      this.provider = 'console';
      return;
    }

    this.transporter = createTransport({
      host: mailHost,
      port: Number(mailPort),
      secure: Number(mailPort) === 465, // true for 465, false for other ports (like 587)
      auth: {
        user: mailUser,
        pass: mailPassword,
      },
      tls: {
        rejectUnauthorized: false, // Prevents certificate chain validation failures in local/dev environments
      },
    });
    this.provider = 'nodemailer';

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
      const templatesDir = path.join(__dirname, 'templates');

      const layoutPath = path.join(templatesDir, 'layout.hbs');
      if (fs.existsSync(layoutPath)) {
        this.layoutTemplate = Handlebars.compile(
          fs.readFileSync(layoutPath, 'utf-8'),
        );
      }

      const authTemplates = [
        'verification',
        'password-reset',
        'welcome',
        'welcome-temp-password',
      ];
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
    const subject = 'Chào mừng bạn đến với Smart Clinic - Smart Clinic';
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
   * Send welcome email with temporary password
   */
  async sendTemporaryPasswordEmail(
    email: string,
    fullName: string,
    tempPassword: string,
  ): Promise<void> {
    const subject = 'Tài khoản Smart Clinic của bạn đã sẵn sàng - Smart Clinic';
    const loginUrl = `${this.configService.get('FRONTEND_URL')}/login`;
    const html = this.compile('welcome-temp-password', {
      fullName,
      email,
      tempPassword,
      loginUrl,
      subject,
      subheader: 'Tài khoản và mật khẩu tạm thời',
    });

    await this.sendMail(email, subject, html, fullName, tempPassword);
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
      if (this.provider === 'resend' && this.resend) {
        await this.sendWithResend(to, subject, html);
        return;
      }

      if (this.provider === 'nodemailer' && this.transporter) {
        await this.sendWithNodemailer(to, subject, html);
        return;
      }

      this.logEmailToConsole(to, subject, fullName, code, 'Console Mode');
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      // Fallback to console logging
      this.logEmailToConsole(to, subject, fullName, code, 'Fallback Mode');
    }
  }

  private async sendWithResend(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const mailFrom = this.getMailFrom();

    if (!mailFrom) {
      throw new Error('RESEND_FROM or MAIL_FROM must be configured');
    }

    const { error } = await this.resend!.emails.send({
      from: mailFrom,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    this.logger.log(`Email sent successfully to ${to} via Resend`);
  }

  private async sendWithNodemailer(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const mailFrom = this.getMailFrom();

    if (!mailFrom) {
      throw new Error('MAIL_FROM must be configured');
    }

    await this.transporter!.sendMail({
      from: mailFrom,
      to,
      subject,
      html,
    });

    this.logger.log(`Email sent successfully to ${to} via Nodemailer`);
  }

  private getMailFrom(): string | undefined {
    return (
      this.configService.get<string>('RESEND_FROM') ||
      this.configService.get<string>('MAIL_FROM')
    );
  }

  private logEmailToConsole(
    to: string,
    subject: string,
    fullName?: string,
    code?: string,
    mode = 'Console Mode',
  ): void {
    this.logger.log(`
      ═══════════════════════════════════════
      📧 EMAIL (${mode})
      ═══════════════════════════════════════
      To: ${to}
      Subject: ${subject}
      ${fullName ? `Name: ${fullName}` : ''}
      ${code ? `OTP Code: ${code}` : ''}
      ═══════════════════════════════════════
    `);
  }
}
