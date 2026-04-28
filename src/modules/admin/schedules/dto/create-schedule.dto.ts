import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleSlotStatus } from '@prisma/client';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'The UUID of the doctor',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({
    description: 'The date for this schedule slot in ISO format (YYYY-MM-DD)',
    example: '2023-12-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Start time of the slot',
    example: '08:00',
  })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    description: 'End time of the slot',
    example: '12:00',
  })
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({
    description: 'Maximum number of patients that can book this slot',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  maxPatients: number;

  @ApiPropertyOptional({
    description: 'The room or location where the appointment takes place',
    example: 'Room 101',
  })
  @IsString()
  @IsOptional()
  roomId?: string;

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
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Status of the schedule',
    example: 'SCHEDULED',
    default: 'SCHEDULED',
  })
  @IsEnum(ScheduleSlotStatus)
  @IsOptional()
  status?: ScheduleSlotStatus;
}
