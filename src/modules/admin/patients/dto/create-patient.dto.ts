import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  Matches,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class AdminCreatePatientDto {
  @ApiProperty({ example: 'patient@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John Patient' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '+84912345678', required: false })
  @ValidateIf(
    (o: AdminCreatePatientDto) =>
      o.phone !== undefined && o.phone !== null && o.phone !== '',
  )
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone?: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: '1990-01-01', required: false })
  @ValidateIf(
    (o: AdminCreatePatientDto) =>
      o.dateOfBirth !== undefined &&
      o.dateOfBirth !== null &&
      o.dateOfBirth !== '',
  )
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'O+', required: false })
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiProperty({ example: '012345678912', required: false })
  @IsOptional()
  @IsString()
  nationalId?: string;

  // Patient Profile Specifics
  @ApiProperty({ example: 'HI12345678', required: false })
  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @ApiProperty({ example: 'Social Insurance VN', required: false })
  @IsOptional()
  @IsString()
  insuranceProvider?: string;

  @ApiProperty({ example: '2025-12-31', required: false })
  @ValidateIf(
    (o: AdminCreatePatientDto) =>
      o.insuranceExpiry !== undefined &&
      o.insuranceExpiry !== null &&
      o.insuranceExpiry !== '',
  )
  @IsDateString()
  insuranceExpiry?: string;

  @ApiProperty({ example: 'Peanuts, Penicillin', required: false })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiProperty({ example: 'Diabetes Type 2', required: false })
  @IsOptional()
  @IsString()
  chronicConditions?: string;

  @ApiProperty({ example: 'Father has hypertension', required: false })
  @IsOptional()
  @IsString()
  familyHistory?: string;
}
