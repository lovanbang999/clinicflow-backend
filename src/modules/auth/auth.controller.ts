import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { MessageCodes } from '../../common/constants/message-codes.const';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({
    short: { ttl: 60000, limit: 5 },
    medium: { ttl: 3600000, limit: 20 },
  })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage(
    MessageCodes.REGISTER_SUCCESS,
    'Registration successful! Please check your email for verification code.',
  )
  @ApiOperation({
    summary: 'Register a new user (PATIENT role) - Sends OTP to email',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful, OTP sent to email',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(MessageCodes.VERIFY_SUCCESS, 'Email verified successfully!')
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully, returns tokens',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP',
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Throttle({
    short: { ttl: 60000, limit: 1 },
    medium: { ttl: 3600000, limit: 5 },
  })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    MessageCodes.RESEND_OTP_SUCCESS,
    'Verification code sent successfully!',
  )
  @ApiOperation({ summary: 'Resend OTP verification code' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendOtp(resendOtpDto);
  }

  @Public()
  @Throttle({
    short: { ttl: 60000, limit: 3 },
    medium: { ttl: 3600000, limit: 10 },
  })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    MessageCodes.FORGOT_PASSWORD_SUCCESS,
    'If an account exists, a password reset OTP has been sent.',
  )
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset instructions sent if email exists',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Throttle({
    short: { ttl: 60000, limit: 5 },
    medium: { ttl: 3600000, limit: 15 },
  })
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    MessageCodes.VERIFY_RESET_OTP_SUCCESS,
    'OTP verified successfully. You can now reset your password.',
  )
  @ApiOperation({
    summary: 'Verify password-reset OTP (step 2 of forgot-password flow)',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP is valid — proceed to reset-password',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async verifyResetOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyResetOtp(verifyOtpDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    MessageCodes.RESET_PASSWORD_SUCCESS,
    'Password reset successfully. You can now log in with your new password.',
  )
  @ApiOperation({
    summary:
      'Set new password using verified OTP (step 3 of forgot-password flow)',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Throttle({
    short: { ttl: 60000, limit: 10 },
    medium: { ttl: 3600000, limit: 30 },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(MessageCodes.LOGIN_SUCCESS, 'Login successful!')
  @ApiOperation({ summary: 'Login user (email must be verified)' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access and refresh tokens',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or email not verified',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(MessageCodes.REFRESH_SUCCESS, 'Token refreshed successfully')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(MessageCodes.LOGOUT_SUCCESS, 'Logged out successfully')
  @ApiOperation({ summary: 'Logout user (revoke refresh token)' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto.refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage(
    MessageCodes.PROFILE_RETRIEVED,
    'Profile retrieved successfully',
  )
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}
