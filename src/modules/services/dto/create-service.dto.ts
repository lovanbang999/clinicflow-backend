import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  Max,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({
    description: 'Service name',
    example: 'Khám tổng quát',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Service name is required' })
  @MinLength(2, { message: 'Service name must be at least 2 characters' })
  @MaxLength(100, { message: 'Service name is too long' })
  name: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Khám sức khỏe định kỳ, kiểm tra các chỉ số cơ bản',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description is too long' })
  description?: string;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 30,
    minimum: 1,
    maximum: 120,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Duration must be positive' })
  @Min(1, { message: 'Duration must be at least 1 minute' })
  @Max(120, { message: 'Duration cannot exceed 120 minutes' })
  durationMinutes: number;

  @ApiProperty({
    description: 'Service price in VND',
    example: 200000,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Price must be non-negative' })
  price: number;

  @ApiProperty({
    description: 'Maximum number of bookings per hour',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Max slots must be positive' })
  @Min(1, { message: 'Max slots must be at least 1' })
  @Max(10, { message: 'Max slots cannot exceed 10' })
  maxSlotsPerHour: number;
}
