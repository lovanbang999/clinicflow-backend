import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsEnum,
  ValidateIf,
  IsBoolean,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
  IsNumber,
} from 'class-validator';
import { UserRole, Gender } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({
    description: 'User phone number',
    example: '0912345678',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @Matches(/^(\+84|0)[0-9]{9,10}$/, {
    message: 'Invalid Vietnamese phone number format',
  })
  phone?: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-05-15',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsEnum(Gender, { message: 'Invalid gender value' })
  gender?: Gender;

  @ApiProperty({
    description: 'Address',
    example: '123 Main St, District 1, HCMC',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    description: 'User active status',
    example: true,
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Reason for locking/suspending the user',
    example: 'Violated policies',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString()
  lockReason?: string | null;

  @ApiProperty({
    description: 'New password',
    example: 'NewPassword123!',
    required: false,
    minLength: 6,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @ApiProperty({
    description: 'Blood Type',
    example: 'A',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  bloodType?: string;

  @ApiProperty({
    description: 'Height in cm',
    example: 175.5,
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber()
  heightCm?: number;

  @ApiProperty({
    description: 'Weight in kg',
    example: 68.2,
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber()
  weightKg?: number;

  @ApiProperty({
    description: 'Allergies',
    example: 'Seafood, Peanut',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  allergies?: string;

  @ApiProperty({
    description: 'Chronic conditions',
    example: 'Hypertension',
    required: false,
  })
  @ValidateIf((o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  chronicConditions?: string;
}
