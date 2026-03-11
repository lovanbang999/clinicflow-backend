import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'patient@clinic.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code received via email',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code: string;
}
