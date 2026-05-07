import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'patient@clinic.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'patient123',
    description: 'User password',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;
}
