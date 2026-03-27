import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUpdateServiceDto {
  @ApiProperty({ required: false, example: 'General Checkup' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiProperty({ required: false, example: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  durationMinutes?: number;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  maxSlotsPerHour?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  preparationNotes?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
