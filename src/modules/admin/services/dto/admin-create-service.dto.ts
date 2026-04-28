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
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminCreateServiceDto {
  @ApiProperty({ example: 'General Checkup', minLength: 2, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, example: 'Standard consultation service' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, example: '/uploads/icons/checkup.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiProperty({ example: 200000, minimum: 0, description: 'Price in VND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 30, minimum: 1, maximum: 120 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(120)
  durationMinutes: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(10)
  maxSlotsPerHour: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

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
