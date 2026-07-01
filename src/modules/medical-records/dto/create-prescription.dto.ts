import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrescriptionItemDto {
  @ApiPropertyOptional({
    example: 'visit-service-order-uuid',
    description:
      'ID of the specific service order this prescription relates to',
  })
  @IsOptional()
  @IsString()
  visitServiceOrderId?: string;

  @ApiPropertyOptional({
    example: 'lab-order-uuid',
    description: 'ID of the specific lab order this prescription relates to',
  })
  @IsOptional()
  @IsString()
  labOrderId?: string;

  @ApiProperty({ example: 'Ibuprofen' })
  @IsString()
  medicineName: string;

  @ApiProperty({ example: '400mg' })
  @IsString()
  dosage: string;

  @ApiProperty({ example: '3 lần/ngày' })
  @IsString()
  frequency: string;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationDays?: number;

  @ApiProperty({ example: 21 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ example: 'viên' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 'Uống sau ăn' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'medicine-uuid' })
  @IsOptional()
  @IsString()
  medicineId?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreatePrescriptionDto {
  @ApiPropertyOptional({ description: 'General prescription notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [PrescriptionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
