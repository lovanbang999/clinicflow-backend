import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description: 'The date for this schedule slot in ISO format (YYYY-MM-DD)',
    example: '2023-12-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    description: 'Start time of the slot',
    example: '08:00',
  })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'End time of the slot',
    example: '12:00',
  })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of patients that can book this slot',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxPatients?: number;

  @ApiPropertyOptional({
    description: 'The room or location where the appointment takes place',
    example: 'Room 101',
  })
  @IsString()
  @IsOptional()
  room?: string;

  @ApiPropertyOptional({
    description: 'Type of the appointment slot',
    example: 'checkup',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the schedule',
    example: 'General checkup slot',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Status of the schedule',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Status of the schedule',
    example: 'SCHEDULED',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
