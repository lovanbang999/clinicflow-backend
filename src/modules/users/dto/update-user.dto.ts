import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { UserRole, Gender } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({
    description: 'User phone number',
    example: '0912345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+84|0)[0-9]{9,10}$/, {
    message: 'Invalid Vietnamese phone number format',
  })
  phone?: string;

  @ApiProperty({
    description: 'Avatar URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Invalid gender value' })
  gender?: Gender;

  @ApiProperty({
    description: 'Address',
    example: '123 Main St, District 1, HCMC',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    description: 'User active status',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'New password',
    example: 'NewPassword123!',
    required: false,
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;
}
