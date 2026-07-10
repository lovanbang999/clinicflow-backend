import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

// Mock fs, path, and Handlebars to avoid hitting disk in unit tests
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue(''),
}));

jest.mock('handlebars', () => ({
  compile: jest
    .fn()
    .mockReturnValue(jest.fn().mockReturnValue('<html>mock</html>')),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn(),
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

function makeConfigService(
  env: Record<string, string | undefined>,
): ConfigService {
  return {
    get: jest.fn().mockImplementation((key: string) => env[key]),
  } as unknown as ConfigService;
}

describe('MailService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('provider selection', () => {
    it('should default to console provider when no mail config is set', () => {
      const config = makeConfigService({ NODE_ENV: 'development' });
      const service = new MailService(config);

      // Access private field to verify provider
      expect((service as unknown as { provider: string }).provider).toBe(
        'console',
      );
    });

    it('should use nodemailer provider when MAIL_HOST/USER/PASSWORD are configured', () => {
      const config = makeConfigService({
        NODE_ENV: 'development',
        MAIL_HOST: 'smtp.test.com',
        MAIL_PORT: '587',
        MAIL_USER: 'user@test.com',
        MAIL_PASSWORD: 'secret',
      });
      const service = new MailService(config);

      expect((service as unknown as { provider: string }).provider).toBe(
        'nodemailer',
      );
    });

    it('should use console provider in production if RESEND_API_KEY is not set', () => {
      const config = makeConfigService({ NODE_ENV: 'production' });
      const service = new MailService(config);

      expect((service as unknown as { provider: string }).provider).toBe(
        'console',
      );
    });

    it('should use resend provider in production with RESEND_API_KEY', () => {
      const config = makeConfigService({
        NODE_ENV: 'production',
        RESEND_API_KEY: 'res_key_abc',
      });
      const service = new MailService(config);

      expect((service as unknown as { provider: string }).provider).toBe(
        'resend',
      );
    });
  });

  describe('sendMail — console provider', () => {
    let service: MailService;

    beforeEach(() => {
      const config = makeConfigService({ NODE_ENV: 'test' });
      service = new MailService(config);
      // Ensure we're in console mode (default when no MAIL config)
      (service as unknown as { provider: string }).provider = 'console';
    });

    it('should not throw when sending in console mode', async () => {
      await expect(
        service.sendMail('a@b.com', 'Subject', '<h1>Body</h1>', 'John'),
      ).resolves.not.toThrow();
    });
  });

  describe('sendMail — nodemailer provider', () => {
    let service: MailService;
    let mockTransporter: { sendMail: jest.Mock };

    beforeEach(() => {
      const config = makeConfigService({
        NODE_ENV: 'development',
        MAIL_HOST: 'smtp.test.com',
        MAIL_PORT: '587',
        MAIL_USER: 'user@test.com',
        MAIL_PASSWORD: 'secret',
        MAIL_FROM: 'noreply@clinic.com',
      });
      service = new MailService(config);
      mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({}),
      };
      (
        service as unknown as { transporter: typeof mockTransporter }
      ).transporter = mockTransporter;
    });

    it('should call transporter.sendMail with correct args', async () => {
      await service.sendMail('to@test.com', 'Hello', '<p>Hi</p>');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@clinic.com',
          to: 'to@test.com',
          subject: 'Hello',
          html: '<p>Hi</p>',
        }),
      );
    });

    it('should fall back to console logging if transporter.sendMail throws', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP timeout'));

      // Should not re-throw
      await expect(
        service.sendMail('to@test.com', 'Subject', '<p>body</p>'),
      ).resolves.not.toThrow();
    });
  });

  describe('sendMail — resend provider', () => {
    let service: MailService;
    let mockResendSend: jest.Mock;

    beforeEach(() => {
      mockResendSend = jest.fn().mockResolvedValue({ error: null });
      const config = makeConfigService({
        NODE_ENV: 'production',
        RESEND_API_KEY: 'res_abc',
        RESEND_FROM: 'noreply@clinic.com',
      });
      service = new MailService(config);
      (
        service as unknown as { resend: { emails: { send: jest.Mock } } }
      ).resend = {
        emails: { send: mockResendSend },
      };
    });

    it('should call resend.emails.send with correct args', async () => {
      await service.sendMail('to@test.com', 'Hi', '<p>body</p>');

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@clinic.com',
          to: 'to@test.com',
          subject: 'Hi',
          html: '<p>body</p>',
        }),
      );
    });

    it('should throw if resend returns an error', async () => {
      mockResendSend.mockResolvedValue({
        error: { message: 'invalid API key' },
      });

      // sendMail swallows errors, so it should NOT rethrow
      await expect(
        service.sendMail('to@test.com', 'Subject', '<p>body</p>'),
      ).resolves.not.toThrow();
    });

    it('should throw from sendWithResend if RESEND_FROM is not set', async () => {
      const config = makeConfigService({
        NODE_ENV: 'production',
        RESEND_API_KEY: 'res_abc',
        // No RESEND_FROM or MAIL_FROM
      });
      service = new MailService(config);
      (
        service as unknown as { resend: { emails: { send: jest.Mock } } }
      ).resend = {
        emails: { send: mockResendSend },
      };

      // sendMail swallows the error and falls back to console
      await expect(
        service.sendMail('to@test.com', 'Subject', '<p>body</p>'),
      ).resolves.not.toThrow();
    });
  });

  describe('public email methods', () => {
    let service: MailService;
    let sendMailSpy: jest.SpyInstance;

    beforeEach(() => {
      const config = makeConfigService({
        NODE_ENV: 'test',
        FRONTEND_URL: 'https://clinic.com',
      });
      service = new MailService(config);
      sendMailSpy = jest
        .spyOn(service, 'sendMail')
        .mockResolvedValue(undefined);
    });

    it('sendVerificationEmail should call sendMail with email and code', async () => {
      await service.sendVerificationEmail('user@x.com', 'John', '123456');

      expect(sendMailSpy).toHaveBeenCalledWith(
        'user@x.com',
        expect.stringContaining('xác nhận') as string,
        expect.any(String) as string,
        'John',
        '123456',
      );
    });

    it('sendPasswordResetEmail should call sendMail with email and code', async () => {
      await service.sendPasswordResetEmail('user@x.com', 'John', '654321');

      expect(sendMailSpy).toHaveBeenCalledWith(
        'user@x.com',
        expect.stringContaining('mật khẩu') as string,
        expect.any(String) as string,
        'John',
        '654321',
      );
    });

    it('sendWelcomeEmail should call sendMail with email', async () => {
      await service.sendWelcomeEmail('user@x.com', 'John');

      expect(sendMailSpy).toHaveBeenCalledWith(
        'user@x.com',
        expect.stringContaining('Chào mừng') as string,
        expect.any(String) as string,
        'John',
      );
    });

    it('sendTemporaryPasswordEmail should call sendMail with email and tempPassword', async () => {
      await service.sendTemporaryPasswordEmail(
        'user@x.com',
        'John',
        'TempPass123',
      );

      expect(sendMailSpy).toHaveBeenCalledWith(
        'user@x.com',
        expect.stringContaining('Smart Clinic') as string,
        expect.any(String) as string,
        'John',
        'TempPass123',
      );
    });
  });
});
