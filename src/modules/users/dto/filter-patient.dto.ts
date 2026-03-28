import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterPatientDto {
  @ApiProperty({
    description: 'Filter by guest status',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = (obj as Record<string, unknown>)[key];
    return value === 'true' || value === true;
  })
  @IsBoolean()
  isGuest?: boolean;

  @ApiProperty({
    description: 'Search by name, phone, or patient code',
    required: false,
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by gender: MALE, FEMALE, OTHER',
    required: false,
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({
    description: 'Filter by status: active, inactive',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Filter by blood type',
    required: false,
  })
  @IsOptional()
  @IsString()
  bloodType?: string;
}
