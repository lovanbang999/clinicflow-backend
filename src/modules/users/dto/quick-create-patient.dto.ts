import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class QuickCreatePatientDto {
  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: 'Patient phone number or ID Card (CCCD)',
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
}
