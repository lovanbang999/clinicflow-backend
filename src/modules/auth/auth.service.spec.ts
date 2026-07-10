import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../notifications/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../database/services/redis.service';
import { I_USER_REPOSITORY } from '../database/interfaces/user.repository.interface';
import { I_TOKEN_REPOSITORY } from '../database/interfaces/token.repository.interface';
import { I_VERIFICATION_REPOSITORY } from '../database/interfaces/verification.repository.interface';
import { ApiException } from '../../common/exceptions/api.exception';
import { VerificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepositoryMock: Record<string, jest.Mock>;
  let tokenRepositoryMock: Record<string, jest.Mock>;
  let verificationRepositoryMock: Record<string, jest.Mock>;
  let jwtServiceMock: Record<string, jest.Mock>;
  let configServiceMock: Record<string, jest.Mock>;
  let mailServiceMock: Record<string, jest.Mock>;
  let notificationsServiceMock: Record<string, jest.Mock>;
  let redisServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    userRepositoryMock = {
      findByEmail: jest.fn(),
      findByEmailWithProfile: jest.fn(),
      createRegisteredPatient: jest.fn(),
      verifyEmailTransaction: jest.fn(),
      resetPasswordTransaction: jest.fn(),
      findByIdWithProfile: jest.fn(),
    };

    tokenRepositoryMock = {
      create: jest.fn(),
      findByTokenWithUser: jest.fn(),
      revokeToken: jest.fn(),
    };

    verificationRepositoryMock = {
      findLatestCode: jest.fn(),
      countCodesSince: jest.fn(),
      create: jest.fn(),
      updateAttempts: jest.fn(),
      invalidateCode: jest.fn(),
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };

    configServiceMock = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'JWT_EXPIRES_IN') return '7d';
          if (key === 'JWT_REFRESH_EXPIRES_IN') return '30d';
          return defaultValue;
        }),
      getOrThrow: jest.fn().mockReturnValue('mock-secret'),
    };

    mailServiceMock = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    notificationsServiceMock = {
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
    };

    redisServiceMock = {
      isReady: jest.fn().mockReturnValue(false), // Start with DB fallback
      get: jest.fn(),
      set: jest.fn(),
      getJson: jest.fn(),
      setJson: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: I_TOKEN_REPOSITORY, useValue: tokenRepositoryMock },
        {
          provide: I_VERIFICATION_REPOSITORY,
          useValue: verificationRepositoryMock,
        },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('OTP and Cooldown limits', () => {
    let serviceAsPrivate: {
      createVerificationCode: (
        userId: string,
        type: VerificationType,
      ) => Promise<string>;
    };

    beforeEach(() => {
      serviceAsPrivate = service as unknown as typeof serviceAsPrivate;
    });

    it('should throw Rate Limit Cooldown error (Postgres path) if time since last OTP is < 60s', async () => {
      redisServiceMock.isReady.mockReturnValue(false);
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        createdAt: new Date(Date.now() - 30000), // 30s ago
      });

      await expect(
        serviceAsPrivate.createVerificationCode(
          'user-1',
          VerificationType.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should throw Rate Limit Daily count error (Postgres path) if OTP count today >= 5', async () => {
      redisServiceMock.isReady.mockReturnValue(false);
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);
      verificationRepositoryMock.countCodesSince.mockResolvedValue(5);

      await expect(
        serviceAsPrivate.createVerificationCode(
          'user-1',
          VerificationType.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should throw Rate Limit Cooldown error (Redis path) if cooldown key exists', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      redisServiceMock.get.mockResolvedValue('1'); // Cooldown exists

      await expect(
        serviceAsPrivate.createVerificationCode(
          'user-1',
          VerificationType.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should throw Rate Limit Daily count error (Redis path) if daily count >= 5', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      redisServiceMock.get.mockImplementation((key: string) => {
        if (key.includes('cooldown')) return Promise.resolve(null);
        if (key.includes('daily')) return Promise.resolve('5');
        return Promise.resolve(null);
      });

      await expect(
        serviceAsPrivate.createVerificationCode(
          'user-1',
          VerificationType.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'password123',
      fullName: 'New User',
      phone: '0987654321',
    };

    it('should throw CONFLICT if email already registered', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({ id: 'user-1' });

      await expect(service.register(registerDto)).rejects.toThrow(ApiException);
    });

    it('should successfully register a patient, hash password, create verification OTP and notify admins', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pass');
      userRepositoryMock.createRegisteredPatient.mockResolvedValue({
        id: 'new-user-id',
        fullName: 'New User',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);
      verificationRepositoryMock.countCodesSince.mockResolvedValue(0);
      verificationRepositoryMock.create.mockResolvedValue({
        id: 'otp-1',
        code: '123456',
      });

      const result = await service.register(registerDto);
      expect(result).toEqual({ email: 'new@example.com' });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userRepositoryMock.createRegisteredPatient).toHaveBeenCalled();
      expect(mailServiceMock.sendVerificationEmail).toHaveBeenCalled();
      expect(notificationsServiceMock.notifyAdmins).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should throw NOT_FOUND if user not found', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ email: 'wrong@example.com', code: '123456' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST if no OTP code found', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ email: 'user@example.com', code: '123456' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST if OTP already used', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        code: '123456',
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyEmail({ email: 'user@example.com', code: '123456' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST if OTP is expired', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        code: '123456',
        isUsed: false,
        expiresAt: new Date(Date.now() - 60000), // expired 1m ago
      });

      await expect(
        service.verifyEmail({ email: 'user@example.com', code: '123456' }),
      ).rejects.toThrow(ApiException);
    });

    it('should increment attempts and throw if OTP code is incorrect', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        isUsed: false,
        attempts: 1,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyEmail({ email: 'user@example.com', code: '000000' }),
      ).rejects.toThrow(ApiException);

      expect(verificationRepositoryMock.updateAttempts).toHaveBeenCalledWith(
        'otp-1',
        2,
      );
    });

    it('should invalidate OTP and throw if attempts exceed 5 times', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        isUsed: false,
        attempts: 4,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyEmail({ email: 'user@example.com', code: '000000' }),
      ).rejects.toThrow(ApiException);

      expect(verificationRepositoryMock.invalidateCode).toHaveBeenCalledWith(
        'otp-1',
      );
    });

    it('should successfully verify email, activate user, send welcome mail, and return tokens', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
      };
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue(mockUser);
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.verifyEmail({
        email: 'user@example.com',
        code: '123456',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(userRepositoryMock.verifyEmailTransaction).toHaveBeenCalledWith(
        'user-1',
        'otp-1',
      );
      expect(mailServiceMock.sendWelcomeEmail).toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    it('should throw NOT_FOUND if user not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.resendOtp({ email: 'wrong@example.com' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST if user is already verified', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        isActive: true,
      });

      await expect(
        service.resendOtp({ email: 'user@example.com' }),
      ).rejects.toThrow(ApiException);
    });

    it('should send new OTP verification email if user is not verified', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
        isActive: false,
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);
      verificationRepositoryMock.countCodesSince.mockResolvedValue(0);
      verificationRepositoryMock.create.mockResolvedValue({
        id: 'otp-2',
        code: '654321',
      });

      const result = await service.resendOtp({ email: 'user@example.com' });
      expect(result).toEqual({ email: 'user@example.com' });
      expect(mailServiceMock.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('should generate password reset token successfully', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);
      verificationRepositoryMock.countCodesSince.mockResolvedValue(0);
      verificationRepositoryMock.create.mockResolvedValue({
        id: 'otp-reset',
        code: '111222',
      });

      const result = await service.forgotPassword({
        email: 'user@example.com',
      });
      expect(result).toEqual({ email: 'user@example.com' });
      expect(mailServiceMock.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return email and not throw if user not found on forgotPassword (prevent email enumeration)', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });
      expect(result).toEqual({ email: 'nonexistent@example.com' });
      expect(mailServiceMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND on verifyResetOtp if user not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.verifyResetOtp({
          email: 'nonexistent@example.com',
          code: '111222',
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST on verifyResetOtp if reset OTP is not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);

      await expect(
        service.verifyResetOtp({
          email: 'user@example.com',
          code: '111222',
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST on verifyResetOtp if reset OTP is already used', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        code: '111222',
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyResetOtp({
          email: 'user@example.com',
          code: '111222',
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST on verifyResetOtp if reset OTP is expired', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        code: '111222',
        isUsed: false,
        expiresAt: new Date(Date.now() - 60000), // expired 1m ago
      });

      await expect(
        service.verifyResetOtp({
          email: 'user@example.com',
          code: '111222',
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should increment attempts and throw if reset OTP code is incorrect', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-reset',
        code: '111222',
        isUsed: false,
        attempts: 1,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyResetOtp({
          email: 'user@example.com',
          code: '000000',
        }),
      ).rejects.toThrow(ApiException);

      expect(verificationRepositoryMock.updateAttempts).toHaveBeenCalledWith(
        'otp-reset',
        2,
      );
    });

    it('should invalidate OTP and throw if attempts exceed 5 times on verifyResetOtp', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-reset',
        code: '111222',
        isUsed: false,
        attempts: 4,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyResetOtp({
          email: 'user@example.com',
          code: '000000',
        }),
      ).rejects.toThrow(ApiException);

      expect(verificationRepositoryMock.invalidateCode).toHaveBeenCalledWith(
        'otp-reset',
      );
    });

    it('should successfully verify reset OTP code', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-reset',
        code: '111222',
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.verifyResetOtp({
        email: 'user@example.com',
        code: '111222',
      });
      expect(result).toEqual({ email: 'user@example.com' });
    });

    it('should throw NOT_FOUND on resetPassword if user not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: 'nonexistent@example.com',
          code: '111222',
          newPassword: 'pass',
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BAD_REQUEST on resetPassword if OTP is invalid/not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: 'user@example.com',
          code: '111222',
          newPassword: 'pass',
        }),
      ).rejects.toThrow(ApiException);
    });

    it('should successfully reset password, hashing new password and consummating transaction', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      verificationRepositoryMock.findLatestCode.mockResolvedValue({
        id: 'otp-reset',
        code: '111222',
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-pass');

      const result = await service.resetPassword({
        email: 'user@example.com',
        code: '111222',
        newPassword: 'new-secure-password',
      });

      expect(result).toEqual({ email: 'user@example.com' });
      expect(bcrypt.hash).toHaveBeenCalledWith('new-secure-password', 10);
      expect(userRepositoryMock.resetPasswordTransaction).toHaveBeenCalledWith(
        'user-1',
        'otp-reset',
        'hashed-new-pass',
      );
    });
  });

  describe('login', () => {
    it('should throw UNAUTHORIZED if invalid credentials (user not found)', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'pass' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw UNAUTHORIZED if account is not email verified', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
        isVerified: false,
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'pass' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw UNAUTHORIZED if account is deactivated', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
        isVerified: true,
        isActive: false,
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'pass' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw UNAUTHORIZED if password check fails', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
        isVerified: true,
        isActive: true,
        password: 'correct-hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong-pass' }),
      ).rejects.toThrow(ApiException);
    });

    it('should login successfully with valid credentials and return tokens', async () => {
      userRepositoryMock.findByEmailWithProfile.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        isVerified: true,
        isActive: true,
        password: 'correct-hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'user@example.com',
        password: 'pass',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token, generating new tokens and revoking old refresh token', async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
      });
      tokenRepositoryMock.findByTokenWithUser.mockResolvedValue({
        isRevoked: false,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.refreshToken({
        refreshToken: 'old-refresh',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(tokenRepositoryMock.revokeToken).toHaveBeenCalledWith(
        'old-refresh',
      );
    });

    it('should throw ApiException if refresh token verification throws (expired)', async () => {
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      jwtServiceMock.verify.mockImplementation(() => {
        throw expiredError;
      });

      await expect(
        service.refreshToken({ refreshToken: 'expired-refresh' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw ApiException if refresh token verification throws (invalid)', async () => {
      jwtServiceMock.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(
        service.refreshToken({ refreshToken: 'invalid-refresh' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw ApiException if stored token is not found', async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
      });
      tokenRepositoryMock.findByTokenWithUser.mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'nonexistent-refresh' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw ApiException if stored token is revoked', async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
      });
      tokenRepositoryMock.findByTokenWithUser.mockResolvedValue({
        isRevoked: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.refreshToken({ refreshToken: 'revoked-refresh' }),
      ).rejects.toThrow(ApiException);
    });

    it('should throw ApiException if stored token is expired in database', async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
      });
      tokenRepositoryMock.findByTokenWithUser.mockResolvedValue({
        isRevoked: false,
        expiresAt: new Date(Date.now() - 60000), // expired 1m ago
      });

      await expect(
        service.refreshToken({ refreshToken: 'db-expired-refresh' }),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('logout', () => {
    it('should revoke token and return null', async () => {
      const result = await service.logout('refresh-token');
      expect(result).toBeNull();
      expect(tokenRepositoryMock.revokeToken).toHaveBeenCalledWith(
        'refresh-token',
      );
    });
  });

  describe('validateUser', () => {
    it('should throw UNAUTHORIZED if user not found', async () => {
      userRepositoryMock.findByIdWithProfile.mockResolvedValue(null);

      await expect(service.validateUser('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UNAUTHORIZED if user is inactive', async () => {
      userRepositoryMock.findByIdWithProfile.mockResolvedValue({
        id: 'user-1',
        isActive: false,
      });

      await expect(service.validateUser('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user if active', async () => {
      userRepositoryMock.findByIdWithProfile.mockResolvedValue({
        id: 'user-1',
        isActive: true,
      });
      const result = await service.validateUser('user-1');
      expect(result.id).toBe('user-1');
    });
  });

  describe('verifyAccessToken', () => {
    it('should throw UNAUTHORIZED if token verification fails', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return payload if token is valid', async () => {
      const payload = { sub: 'user-1', email: 'user@example.com' };
      jwtServiceMock.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyAccessToken('valid-token');
      expect(result).toEqual(payload);
    });
  });

  describe('getProfile', () => {
    it('should return user profile if active', async () => {
      userRepositoryMock.findByIdWithProfile.mockResolvedValue({
        id: 'user-1',
        isActive: true,
      });

      const result = await service.getProfile('user-1');
      expect(result.id).toBe('user-1');
    });
  });
});
