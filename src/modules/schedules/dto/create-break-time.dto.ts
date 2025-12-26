import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  Matches,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateBreakTimeDto {
  @ApiProperty({
    description: 'Doctor ID',
    example: 'uuid-doctor-id',
  })
  @IsUUID('4')
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({
    description: 'Date (YYYY-MM-DD)',
    example: '2024-12-26',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Start time (HH:mm format)',
    example: '12:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  startTime: string;

  @ApiProperty({
    description: 'End time (HH:mm format)',
    example: '13:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;

  @ApiProperty({
    description: 'Reason for break',
    example: 'Lunch break',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
