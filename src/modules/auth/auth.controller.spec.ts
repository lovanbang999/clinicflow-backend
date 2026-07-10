import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      resendOtp: jest.fn(),
      forgotPassword: jest.fn(),
      verifyResetOtp: jest.fn(),
      resetPassword: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      getProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('register should delegate to AuthService.register with registerDto', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
      phone: '0901234567',
    };
    serviceMock.register.mockResolvedValue({ message: 'Success' });
    const result = await controller.register(dto);
    expect(result).toEqual({ message: 'Success' });
    expect(serviceMock.register).toHaveBeenCalledWith(dto);
  });

  it('verifyEmail should delegate to AuthService.verifyEmail with verifyEmailDto', async () => {
    const dto: VerifyEmailDto = { email: 'test@example.com', code: '123456' };
    serviceMock.verifyEmail.mockResolvedValue({ accessToken: 'access' });
    const result = await controller.verifyEmail(dto);
    expect(result).toEqual({ accessToken: 'access' });
    expect(serviceMock.verifyEmail).toHaveBeenCalledWith(dto);
  });

  it('resendOtp should delegate to AuthService.resendOtp with resendOtpDto', async () => {
    const dto: ResendOtpDto = { email: 'test@example.com' };
    serviceMock.resendOtp.mockResolvedValue({ message: 'OTP Resent' });
    const result = await controller.resendOtp(dto);
    expect(result).toEqual({ message: 'OTP Resent' });
    expect(serviceMock.resendOtp).toHaveBeenCalledWith(dto);
  });

  it('forgotPassword should delegate to AuthService.forgotPassword', async () => {
    const dto: ForgotPasswordDto = { email: 'test@example.com' };
    serviceMock.forgotPassword.mockResolvedValue({ message: 'OTP Sent' });
    const result = await controller.forgotPassword(dto);
    expect(result).toEqual({ message: 'OTP Sent' });
    expect(serviceMock.forgotPassword).toHaveBeenCalledWith(dto);
  });

  it('verifyResetOtp should delegate to AuthService.verifyResetOtp', async () => {
    const dto: VerifyOtpDto = { email: 'test@example.com', code: '123456' };
    serviceMock.verifyResetOtp.mockResolvedValue({ message: 'Valid OTP' });
    const result = await controller.verifyResetOtp(dto);
    expect(result).toEqual({ message: 'Valid OTP' });
    expect(serviceMock.verifyResetOtp).toHaveBeenCalledWith(dto);
  });

  it('resetPassword should delegate to AuthService.resetPassword', async () => {
    const dto: ResetPasswordDto = {
      email: 'test@example.com',
      code: '123456',
      newPassword: 'newPassword123',
    };
    serviceMock.resetPassword.mockResolvedValue({ message: 'Reset done' });
    const result = await controller.resetPassword(dto);
    expect(result).toEqual({ message: 'Reset done' });
    expect(serviceMock.resetPassword).toHaveBeenCalledWith(dto);
  });

  it('login should delegate to AuthService.login', async () => {
    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    serviceMock.login.mockResolvedValue({ accessToken: 'token' });
    const result = await controller.login(dto);
    expect(result).toEqual({ accessToken: 'token' });
    expect(serviceMock.login).toHaveBeenCalledWith(dto);
  });

  it('refreshToken should delegate to AuthService.refreshToken', async () => {
    const dto: RefreshTokenDto = { refreshToken: 'refresh' };
    serviceMock.refreshToken.mockResolvedValue({ accessToken: 'newAccess' });
    const result = await controller.refreshToken(dto);
    expect(result).toEqual({ accessToken: 'newAccess' });
    expect(serviceMock.refreshToken).toHaveBeenCalledWith(dto);
  });

  it('logout should delegate to AuthService.logout', async () => {
    const dto: RefreshTokenDto = { refreshToken: 'refresh' };
    serviceMock.logout.mockResolvedValue({ message: 'Logged out' });
    const result = await controller.logout(dto);
    expect(result).toEqual({ message: 'Logged out' });
    expect(serviceMock.logout).toHaveBeenCalledWith('refresh');
  });

  it('getProfile should delegate to AuthService.getProfile using current user id', async () => {
    serviceMock.getProfile.mockResolvedValue({
      id: 'u-1',
      email: 'test@example.com',
    });
    const result = await controller.getProfile('u-1');
    expect(result).toEqual({ id: 'u-1', email: 'test@example.com' });
    expect(serviceMock.getProfile).toHaveBeenCalledWith('u-1');
  });

  it('should propagate UnauthorizedException from login service', async () => {
    const dto: LoginDto = { email: 'test@example.com', password: 'wrong' };
    serviceMock.login.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );
    await expect(controller.login(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('should propagate BadRequestException from verify-email service', async () => {
    const dto: VerifyEmailDto = { email: 'test@example.com', code: 'wrong' };
    serviceMock.verifyEmail.mockRejectedValue(
      new BadRequestException('Invalid OTP'),
    );
    await expect(controller.verifyEmail(dto)).rejects.toThrow(
      BadRequestException,
    );
  });
});
