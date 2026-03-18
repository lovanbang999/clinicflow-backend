import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsEnum,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class BasePatientProfileDto {
  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: 'Patient phone number',
    example: '0912345678',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+]{9,15}$/, {
    message: 'Invalid phone number format',
  })
  phone: string;

  @ApiProperty({
    description: 'Patient date of birth (YYYY-MM-DD)',
    example: '1990-01-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Patient gender',
    enum: Gender,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bloodType?: string;
}

export class RegisterPatientDto extends BasePatientProfileDto {
  @ApiProperty({
    description: 'Patient email - Required for system accounts',
    example: 'patient@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class CreateGuestPatientDto extends BasePatientProfileDto {}
