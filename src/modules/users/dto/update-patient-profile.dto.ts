import {
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { BasePatientProfileDto } from './quick-create-patient.dto';

export class UpdatePatientProfileDto extends PartialType(
  BasePatientProfileDto,
) {
  @ApiProperty({ example: 'patient@example.com', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 'HI12345678', required: false })
  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @ApiProperty({ example: 'Social Insurance VN', required: false })
  @IsOptional()
  @IsString()
  insuranceProvider?: string;

  @ApiProperty({ example: '2025-12-31', required: false })
  @ValidateIf(
    (o: UpdatePatientProfileDto) =>
      o.insuranceExpiry !== undefined &&
      o.insuranceExpiry !== null &&
      o.insuranceExpiry !== '',
  )
  @IsDateString()
  @IsOptional()
  insuranceExpiry?: string;

  @ApiProperty({ example: 'Peanuts, Penicillin', required: false })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiProperty({ example: 'Diabetes Type 2', required: false })
  @IsOptional()
  @IsString()
  chronicConditions?: string;

  @ApiProperty({ example: 'Father has hypertension', required: false })
  @IsOptional()
  @IsString()
  familyHistory?: string;
}
