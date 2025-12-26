import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SmartSuggestionsQueryDto {
  @ApiProperty({
    description: 'Doctor ID',
    example: 'uuid-doctor-id',
  })
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctorId: string;

  @ApiProperty({
    description: 'Service ID',
    example: 'uuid-service-id',
  })
  @IsUUID('4', { message: 'Invalid service ID format' })
  serviceId: string;

  @ApiProperty({
    description: 'Start date for search range (YYYY-MM-DD)',
    example: '2024-12-26',
  })
  @IsDateString({}, { message: 'Invalid start date format. Use YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({
    description: 'End date for search range (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsDateString({}, { message: 'Invalid end date format. Use YYYY-MM-DD' })
  endDate: string;

  @ApiProperty({
    description: 'Number of suggestions to return',
    required: false,
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;

  @ApiProperty({
    description: 'Prefer morning slots (8AM-11AM)',
    required: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  preferMorning?: boolean = false;

  @ApiProperty({
    description: 'Prefer afternoon slots (2PM-4PM)',
    required: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  preferAfternoon?: boolean = false;

  @ApiProperty({
    description: 'Earliest acceptable time (HH:mm)',
    required: false,
    example: '08:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  earliestTime?: string;

  @ApiProperty({
    description: 'Latest acceptable time (HH:mm)',
    required: false,
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format. Use HH:mm',
  })
  latestTime?: string;
}
