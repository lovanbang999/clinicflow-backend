import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';

export class FilterBookingDto {
  @ApiProperty({
    description: 'Filter by patient ID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  patientId?: string;

  @ApiProperty({
    description: 'Filter by doctor ID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  doctorId?: string;

  @ApiProperty({
    description: 'Filter by service ID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiProperty({
    description: 'Filter by status',
    enum: BookingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiProperty({
    description: 'Filter by date (YYYY-MM-DD)',
    required: false,
    example: '2024-12-25',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
