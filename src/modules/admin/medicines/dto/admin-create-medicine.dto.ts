import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminCreateMedicineDto {
  @ApiProperty({ example: 'MED-0001', description: 'Unique medicine code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Paracetamol', description: 'Generic/chemical name' })
  @IsString()
  @IsNotEmpty()
  genericName: string;

  @ApiProperty({
    required: false,
    example: 'Panadol Extra',
    description: 'Commercial/brand name',
  })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiProperty({ required: false, example: '500mg' })
  @IsOptional()
  @IsString()
  concentration?: string;

  @ApiProperty({ required: false, example: 'Tablet / Viên nén' })
  @IsOptional()
  @IsString()
  dosageForm?: string;

  @ApiProperty({ required: false, default: 'viên' })
  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @ApiProperty({
    example: 1000,
    minimum: 0,
    description: 'Default retail price per unit',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPrice: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ example: 500, minimum: 0, description: 'Stock quantity' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockQuantity: number;

  @ApiProperty({ required: false, example: 'Take after meals' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, example: 'VD-21342-14' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ required: false, example: 'Paracetamol 500mg, Caffeine 65mg' })
  @IsOptional()
  @IsString()
  ingredients?: string;

  @ApiProperty({ required: false, example: 'Drowsiness, dry mouth' })
  @IsOptional()
  @IsString()
  sideEffects?: string;

  @ApiProperty({ required: false, example: 'Do not use with alcohol' })
  @IsOptional()
  @IsString()
  warnings?: string;

  @ApiProperty({ required: false, example: 'Sanofi' })
  @IsOptional()
  @IsString()
  manufacturerBrand?: string;

  @ApiProperty({ required: false, example: 'Vietnam' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false, example: 'https://example.com/med.png' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  @ApiProperty({
    required: false,
    example: 'Adults: 1-2 tablets every 4-6 hours',
  })
  @IsOptional()
  @IsString()
  usage?: string;

  @ApiProperty({ required: false, example: 'Pain relief, fever reduction' })
  @IsOptional()
  @IsString()
  uses?: string;
}
