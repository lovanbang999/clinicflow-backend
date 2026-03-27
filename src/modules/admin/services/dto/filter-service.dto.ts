import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterServiceDto {
  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = (obj as Record<string, unknown>)[key];
    return value === 'true' || value === true;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    type: String,
    description: 'Search by name or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, type: Number, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  page?: number = 1;

  @ApiProperty({ required: false, type: Number, default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 10;
}
