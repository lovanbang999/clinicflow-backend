import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueueFilterDto {
  @ApiProperty({
    description: 'Filter by doctor ID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  doctorId?: string;

  @ApiProperty({
    description: 'Filter by date (YYYY-MM-DD)',
    required: false,
    example: '2024-12-25',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Filter by time slot',
    required: false,
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  timeSlot?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
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
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
