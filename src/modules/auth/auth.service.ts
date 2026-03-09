import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole, VerificationType } from '@prisma/client';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import type { StringValue } from 'ms';

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
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Expires in 15 minutes

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code,
        type,
        expiresAt,
      },
    });

    return code;
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
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Register a new user (default role: PATIENT)
   */
  async register(registerDto: RegisterDto) {
    const { email, password, fullName, phone } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

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
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        phone,
        role: UserRole.PATIENT,
        isActive: false,
      },
    });

    // Generate OTP code
    const otpCode = await this.createVerificationCode(
      user.id,
      VerificationType.EMAIL_VERIFICATION,
    );

    // Send verification email
    await this.mailService.sendVerificationEmail(email, fullName, otpCode);

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
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'User not found',
        404,
        'Verification failed',
      );
    }

    // Find verification code
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
        type: VerificationType.EMAIL_VERIFICATION,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new ApiException(
        MessageCodes.INVALID_OTP,
        'Invalid verification code',
        400,
        'Verification failed',
      );
    }

    // Check if code is expired
    if (new Date() > verificationCode.expiresAt) {
      throw new ApiException(
        MessageCodes.OTP_EXPIRED,
        'Verification code has expired',
        400,
        'Verification failed',
      );
    }

    // Mark code as used and activate user
    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      }),
    ]);

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

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

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
   * Login user
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.INVALID_CREDENTIALS,
        'Invalid email or password',
        401,
        'Login failed',
      );
    }

    // Check if email is verified
    if (!user.isActive) {
      throw new ApiException(
        MessageCodes.ACCOUNT_NOT_VERIFIED,
        'Please verify your email first',
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
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

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
      await this.prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });

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
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return user;
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
