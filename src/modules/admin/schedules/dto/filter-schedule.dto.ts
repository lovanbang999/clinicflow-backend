import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterScheduleDto {
  @ApiPropertyOptional({
    description: 'Filter schedules by specific doctor UUID',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsString()
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({
    description: 'Filter schedules from this startDate (ISO string YYYY-MM-DD)',
    example: '2023-11-01',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter schedules up to this endDate (ISO string YYYY-MM-DD)',
    example: '2023-11-30',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by whether the schedule is active',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by schedule status',
    enum: ['scheduled', 'completed', 'canceled'],
  })
  @IsOptional()
  @IsString()
  status?: 'scheduled' | 'completed' | 'canceled';
}
