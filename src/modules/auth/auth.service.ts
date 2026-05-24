import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MailService } from '../notifications/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerificationType } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import type { StringValue } from 'ms';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../database/interfaces/user.repository.interface';
import {
  ITokenRepository,
  I_TOKEN_REPOSITORY,
} from '../database/interfaces/token.repository.interface';
import {
  IVerificationRepository,
  I_VERIFICATION_REPOSITORY,
} from '../database/interfaces/verification.repository.interface';
import { RedisService } from '../database/services/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
    @Inject(I_VERIFICATION_REPOSITORY)
    private readonly verificationRepository: IVerificationRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create verification code record
   */
  private async createVerificationCode(
    userId: string,
    type: VerificationType,
  ): Promise<string> {
    const todayStr = new Date().toISOString().split('T')[0];
    const cooldownKey = `auth:otp:cooldown:${userId}:${type}`;
    const dailyKey = `auth:otp:daily:${userId}:${type}:${todayStr}`;
    const otpKey = `auth:otp:${userId}:${type}`;

    // 1. Check Cooldown & Daily Limit via Redis if ready
    if (this.redisService.isReady()) {
      const hasCooldown = await this.redisService.get(cooldownKey);
      if (hasCooldown) {
        throw new ApiException(
          'AUTH.OTP.COOLDOWN',
          'Vui lòng đợi 60 giây trước khi yêu cầu mã OTP mới.',
          429,
          'Rate limit exceeded',
        );
      }

      const dailyCountStr = await this.redisService.get(dailyKey);
      const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
      if (dailyCount >= 5) {
        throw new ApiException(
          'AUTH.OTP.DAILY_LIMIT',
          'Bạn đã vượt quá số lần yêu cầu OTP trong ngày (tối đa 5 lần).',
          429,
          'Daily limit exceeded',
        );
      }
    } else {
      // Postgres Fallback if Redis is down
      const latestCode = await this.verificationRepository.findLatestCode(
        userId,
        type,
      );
      if (latestCode) {
        const timeSinceLastCode = Date.now() - latestCode.createdAt.getTime();
        if (timeSinceLastCode < 60000) {
          throw new ApiException(
            'AUTH.OTP.COOLDOWN',
            'Vui lòng đợi 60 giây trước khi yêu cầu mã OTP mới.',
            429,
            'Rate limit exceeded',
          );
        }
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const countToday = await this.verificationRepository.countCodesSince(
        userId,
        type,
        startOfDay,
      );
      if (countToday >= 5) {
        throw new ApiException(
          'AUTH.OTP.DAILY_LIMIT',
          'Bạn đã vượt quá số lần yêu cầu OTP trong ngày (tối đa 5 lần).',
          429,
          'Daily limit exceeded',
        );
      }
    }

    // 2. Generate and store OTP in DB
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Expires in 15 minutes

    const dbRecord = await this.verificationRepository.create({
      userId,
      code,
      type,
      expiresAt,
    });

    // 3. Cache OTP and update rate limits in Redis if ready
    if (this.redisService.isReady()) {
      // Cache the OTP structure
      await this.redisService.setJson(
        otpKey,
        {
          id: dbRecord.id,
          code,
          attempts: 0,
          expiresAt: expiresAt.getTime(),
          isUsed: false,
        },
        900,
      ); // 15 mins TTL

      // Set cooldown (60s)
      await this.redisService.set(cooldownKey, '1', 60);

      // Increment daily counter (24h TTL)
      const currentDaily = await this.redisService.incr(dailyKey);
      if (currentDaily === 1) {
        await this.redisService.expire(dailyKey, 86400); // Set 24h TTL on new counter
      }
    }

    return code;
  }

  /**
   * Get or Fetch OTP Code from Redis or Postgres
   */
  private async getOrFetchOtpCode(
    userId: string,
    type: VerificationType,
  ): Promise<{
    id: string;
    code: string;
    attempts: number;
    expiresAt: Date;
    isUsed: boolean;
    isFromCache: boolean;
  } | null> {
    const otpKey = `auth:otp:${userId}:${type}`;

    if (this.redisService.isReady()) {
      interface OtpCacheEntry {
        id: string;
        code: string;
        attempts: number;
        expiresAt: number;
        isUsed: boolean;
      }
      const cached = await this.redisService.getJson<OtpCacheEntry>(otpKey);
      if (cached) {
        return {
          id: cached.id,
          code: cached.code,
          attempts: cached.attempts,
          expiresAt: new Date(cached.expiresAt),
          isUsed: cached.isUsed,
          isFromCache: true,
        };
      }
    }

    const latestCode = await this.verificationRepository.findLatestCode(
      userId,
      type,
    );
    if (!latestCode) {
      return null;
    }

    return {
      id: latestCode.id,
      code: latestCode.code,
      attempts: latestCode.attempts,
      expiresAt: latestCode.expiresAt,
      isUsed: latestCode.isUsed,
      isFromCache: false,
    };
  }

  /**
   * Handle invalid OTP attempts with auto-blocking in both Redis and DB
   */
  private async handleInvalidAttempt(
    userId: string,
    type: VerificationType,
    otp: { id: string; attempts: number; isFromCache: boolean },
  ): Promise<number> {
    const newAttempts = otp.attempts + 1;
    const otpKey = `auth:otp:${userId}:${type}`;

    // Always update attempts in DB first
    await this.verificationRepository.updateAttempts(otp.id, newAttempts);

    if (newAttempts >= 5) {
      // Invalidate in DB
      await this.verificationRepository.invalidateCode(otp.id);
      // Invalidate in Redis
      if (this.redisService.isReady()) {
        await this.redisService.del(otpKey);
      }
      throw new ApiException(
        'AUTH.OTP.BLOCKED',
        'Mã OTP đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.',
        400,
        'Verification failed',
      );
    }

    // Update attempts in Redis if it was from cache
    if (otp.isFromCache && this.redisService.isReady()) {
      interface OtpCacheEntry {
        id: string;
        code: string;
        attempts: number;
        expiresAt: number;
        isUsed: boolean;
      }
      const cached = await this.redisService.getJson<OtpCacheEntry>(otpKey);
      if (cached) {
        const updated: OtpCacheEntry = { ...cached, attempts: newAttempts };
        await this.redisService.setJson(otpKey, updated, 900);
      }
    }

    return newAttempts;
  }

  /**
   * Clean Redis cache when an OTP is consumed
   */
  private async markOtpAsUsed(
    userId: string,
    type: VerificationType,
  ): Promise<void> {
    const otpKey = `auth:otp:${userId}:${type}`;
    if (this.redisService.isReady()) {
      await this.redisService.del(otpKey);
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokenPair(
    userId: string,
    email: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_EXPIRES_IN',
        '7d',
      ) as StringValue,
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '30d',
      ) as StringValue,
    });

    // Calculate expiration date for refresh token (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store refresh token in database
    await this.tokenRepository.create({
      userId,
      token: refreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Register a new user (default role: PATIENT)
   */
  async register(registerDto: RegisterDto) {
    const { email, password, fullName, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new ApiException(
        MessageCodes.EMAIL_ALREADY_EXISTS,
        'Email already registered',
        409,
        'Registration failed',
      );
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user with isActive = false
    const patientCode = `PT-${Date.now().toString().slice(-6)}-${phone ? phone.slice(-4) : Math.floor(1000 + Math.random() * 9000)}`;
    const user = await this.userRepository.createRegisteredPatient(
      {
        email,
        password: hashedPassword,
        fullName,
        phone,
        role: 'PATIENT',
        isActive: false,
      },
      { patientCode, fullName },
    );

    // Generate OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.EMAIL_VERIFICATION,
    );

    // Send verification email
    await this.mailService.sendVerificationEmail(email, fullName, otpCode);

    // Notify admins of new registration
    await this.notificationsService.notifyAdmins({
      title: 'Thành viên mới',
      content: `${fullName} vừa đăng ký tài khoản bệnh nhân.`,
      metadata: { userId: user.id },
    });

    return ResponseHelper.success(
      { email },
      MessageCodes.REGISTER_SUCCESS,
      'Registration successful! Please check your email for verification code.',
      201,
    );
  }

  /**
   * Verify email with OTP code
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, code } = verifyEmailDto;

    // Find user
    const user = await this.userRepository.findByEmailWithProfile(email);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Verification failed',
      );
    }

    // Find latest verification code from Redis or Postgres fallback
    const latestCode = await this.getOrFetchOtpCode(
      user.id,
      VerificationType.EMAIL_VERIFICATION,
    );

    if (!latestCode) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Không tìm thấy mã OTP nào',
        400,
        'Verification failed',
      );
    }

    if (latestCode.isUsed) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Mã OTP đã được sử dụng hoặc đã bị vô hiệu hóa',
        400,
        'Verification failed',
      );
    }

    // Check if code is expired
    if (new Date() > latestCode.expiresAt) {
      throw new ApiException(
        MessageCodes.OTP_EXPIRED,
        'Mã OTP đã hết hạn',
        400,
        'Verification failed',
      );
    }

    if (latestCode.code !== code) {
      const newAttempts = await this.handleInvalidAttempt(
        user.id,
        VerificationType.EMAIL_VERIFICATION,
        latestCode,
      );

      throw new ApiException(
        MessageCodes.INVALID_OTP,
        `Mã OTP không đúng. Bạn còn ${5 - newAttempts} lần thử.`,
        400,
        'Verification failed',
      );
    }

    // Clear from Redis Cache
    await this.markOtpAsUsed(user.id, VerificationType.EMAIL_VERIFICATION);

    // Mark code as used and activate user inside a transaction hidden in the repository
    await this.userRepository.verifyEmailTransaction(user.id, latestCode.id);

    // Send welcome email
    await this.mailService.sendWelcomeEmail(email, user.fullName);

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email);

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: { ...userWithoutPassword, isActive: true },
        ...tokens,
      },
      MessageCodes.VERIFY_SUCCESS,
      'Email verified successfully!',
      200,
    );
  }

  /**
   * Resend OTP code
   */
  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { email } = resendOtpDto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Resend OTP failed',
      );
    }

    if (user.isActive) {
      throw new ApiException(
        'AUTH.VERIFY.ALREADY_VERIFIED',
        'Account is already verified',
        400,
        'Resend OTP failed',
      );
    }

    // Generate new OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.EMAIL_VERIFICATION,
    );

    // Send verification email
    await this.mailService.sendVerificationEmail(email, user.fullName, otpCode);

    return ResponseHelper.success(
      { email },
      'AUTH.RESEND_OTP.SUCCESS',
      'Verification code sent successfully!',
      200,
    );
  }

  /**
   * Request password reset OTP
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Don't throw error to prevent email enumeration, just return success
      return ResponseHelper.success(
        { email },
        'AUTH.FORGOT_PASSWORD.SUCCESS',
        'If an account exists, a password reset OTP has been sent.',
        200,
      );
    }

    // Generate password reset OTP code using the correct VerificationType
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.PASSWORD_RESET,
    );

    await this.mailService.sendPasswordResetEmail(
      email,
      user.fullName,
      otpCode,
    );

    return ResponseHelper.success(
      { email },
      'AUTH.FORGOT_PASSWORD.SUCCESS',
      'Password reset instructions sent successfully',
      200,
    );
  }

  /**
   * Verify the password-reset OTP (Step 2 of forgot-password flow)
   * Does NOT mark the code as used — that happens in resetPassword().
   */
  async verifyResetOtp(dto: VerifyOtpDto) {
    const { email, code } = dto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'OTP verification failed',
      );
    }

    const latestCode = await this.getOrFetchOtpCode(
      user.id,
      VerificationType.PASSWORD_RESET,
    );

    if (!latestCode) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Không tìm thấy mã OTP nào',
        400,
        'OTP verification failed',
      );
    }

    if (latestCode.isUsed) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Mã OTP đã được sử dụng hoặc đã bị vô hiệu hóa',
        400,
        'OTP verification failed',
      );
    }

    // Check if code is expired
    if (new Date() > latestCode.expiresAt) {
      throw new ApiException(
        MessageCodes.OTP_EXPIRED,
        'Mã OTP đã hết hạn',
        400,
        'OTP verification failed',
      );
    }

    if (latestCode.code !== code) {
      const newAttempts = await this.handleInvalidAttempt(
        user.id,
        VerificationType.PASSWORD_RESET,
        latestCode,
      );

      throw new ApiException(
        MessageCodes.INVALID_OTP,
        `Mã OTP không đúng. Bạn còn ${5 - newAttempts} lần thử.`,
        400,
        'OTP verification failed',
      );
    }

    return ResponseHelper.success(
      { email },
      MessageCodes.VERIFY_RESET_OTP_SUCCESS,
      'OTP verified successfully. You can now reset your password.',
      200,
    );
  }

  /**
   * Reset password using verified OTP (Step 3 of forgot-password flow)
   * Re-validates the OTP, marks it as used and updates the password atomically.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const { email, code, newPassword } = dto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Password reset failed',
      );
    }

    const latestCode = await this.getOrFetchOtpCode(
      user.id,
      VerificationType.PASSWORD_RESET,
    );

    if (!latestCode) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Không tìm thấy mã OTP nào',
        400,
        'Password reset failed',
      );
    }

    if (latestCode.isUsed) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Mã OTP đã được sử dụng hoặc đã bị vô hiệu hóa',
        400,
        'Password reset failed',
      );
    }

    if (new Date() > latestCode.expiresAt) {
      throw new ApiException(
        MessageCodes.OTP_EXPIRED,
        'Mã OTP đã hết hạn',
        400,
        'Password reset failed',
      );
    }

    if (latestCode.code !== code) {
      const newAttempts = await this.handleInvalidAttempt(
        user.id,
        VerificationType.PASSWORD_RESET,
        latestCode,
      );

      throw new ApiException(
        MessageCodes.INVALID_OTP,
        `Mã OTP không đúng. Bạn còn ${5 - newAttempts} lần thử.`,
        400,
        'Password reset failed',
      );
    }

    const hashedPassword = await this.hashPassword(newPassword);

    // Clear from Redis Cache
    await this.markOtpAsUsed(user.id, VerificationType.PASSWORD_RESET);

    // Mark code as used and update the password in one atomic transaction
    await this.userRepository.resetPasswordTransaction(
      user.id,
      latestCode.id,
      hashedPassword,
    );

    return ResponseHelper.success(
      { email },
      MessageCodes.RESET_PASSWORD_SUCCESS,
      'Password reset successfully. You can now log in with your new password.',
      200,
    );
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findByEmailWithProfile(email);

    if (!user) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Invalid email or password',
        401,
        'Login failed',
      );
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new ApiException(
        MessageCodes.ACCOUNT_NOT_VERIFIED,
        'Please verify your email first',
        401,
        'Login failed',
      );
    }

    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_INACTIVE,
        'Account is inactive',
        401,
        'Login failed',
      );
    }

    // Verify password
    const isPasswordValid = await this.comparePasswords(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Invalid email or password',
        401,
        'Login failed',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email);

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    return ResponseHelper.success(
      {
        user: userWithoutPassword,
        ...tokens,
      },
      MessageCodes.LOGIN_SUCCESS,
      'Login successful!',
      200,
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in database and not revoked
      const storedToken =
        await this.tokenRepository.findByTokenWithUser(refreshToken);

      if (!storedToken || storedToken.isRevoked) {
        throw new ApiException(
          MessageCodes.INVALID_REFRESH_TOKEN,
          'Invalid refresh token',
          401,
          'Token refresh failed',
        );
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        throw new ApiException(
          MessageCodes.REFRESH_TOKEN_EXPIRED,
          'Refresh token has expired',
          401,
          'Token refresh failed',
        );
      }

      // Generate new token pair
      const tokens = await this.generateTokenPair(payload.sub, payload.email);

      // Revoke old refresh token
      await this.tokenRepository.revokeToken(refreshToken);

      return ResponseHelper.success(
        tokens,
        MessageCodes.REFRESH_SUCCESS,
        'Token refreshed successfully',
        200,
      );
    } catch {
      throw new ApiException(
        MessageCodes.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
        401,
        'Token refresh failed',
      );
    }
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string) {
    await this.tokenRepository.revokeToken(refreshToken);

    return ResponseHelper.success(
      null,
      MessageCodes.LOGOUT_SUCCESS,
      'Logged out successfully',
      200,
    );
  }

  /**
   * Validate user (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.userRepository.findByIdWithProfile(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return user;
  }

  /**
   * Verify access token (used by websockets)
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.validateUser(userId);

    return ResponseHelper.success(
      user,
      MessageCodes.PROFILE_RETRIEVED,
      'Profile retrieved successfully',
      200,
    );
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare passwords
   */
  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
