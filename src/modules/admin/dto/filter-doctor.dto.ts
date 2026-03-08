import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Query DTO for GET /admin/doctors
 * Supports filtering by specialty, active status, search and pagination.
 */
export class FilterDoctorDto {
  @ApiProperty({
    description: 'Filter by specialty (exact string match)',
    required: false,
    example: 'Cardiology',
  })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Full-text search on doctor name or email',
    required: false,
    example: 'Nguyen',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page (max 50)',
    required: false,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
