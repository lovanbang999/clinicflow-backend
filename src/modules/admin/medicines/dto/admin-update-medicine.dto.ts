import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUpdateMedicineDto {
  @ApiProperty({ required: false, example: 'MED-0001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, example: 'Paracetamol' })
  @IsOptional()
  @IsString()
  genericName?: string;

  @ApiProperty({ required: false, example: 'Panadol Extra' })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiProperty({ required: false, example: '500mg' })
  @IsOptional()
  @IsString()
  concentration?: string;

  @ApiProperty({ required: false, example: 'Tablet' })
  @IsOptional()
  @IsString()
  dosageForm?: string;

  @ApiProperty({ required: false, default: 'viên' })
  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @ApiProperty({ required: false, example: 1000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ required: false, example: 500, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ingredients?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sideEffects?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warnings?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  manufacturerBrand?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  usage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uses?: string;
}
