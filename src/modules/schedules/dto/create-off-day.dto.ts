import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateOffDayDto {
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
    description: 'Reason for off day',
    example: 'Holiday',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
