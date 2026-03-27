import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export class UpdateBookingRulesDto {
  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  closeTime?: string;

  @ApiPropertyOptional({ example: 15, description: 'Slot duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDuration?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'No-show grace period in minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  noShowGraceMinutes?: number;

  @ApiPropertyOptional({
    example: 24,
    description: 'Minimum hours before cancelation',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancelationWindowHours?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowOnlineBooking?: boolean;
}
