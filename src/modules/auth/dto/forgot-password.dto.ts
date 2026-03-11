import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'patient@clinic.com',
    description: 'User email address to send password reset link',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}
