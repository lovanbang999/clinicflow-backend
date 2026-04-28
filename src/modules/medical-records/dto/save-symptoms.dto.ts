import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SaveSymptomsDto {
  @ApiPropertyOptional({ description: 'Chief complaint / Lý do khám' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({
    description: 'Clinical findings / Kết quả thăm khám lâm sàng',
  })
  @IsOptional()
  @IsString()
  clinicalFindings?: string;

  @ApiPropertyOptional({ description: "Doctor's notes" })
  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @ApiPropertyOptional({ example: '120/80' })
  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @ApiPropertyOptional({ example: 72 })
  @IsOptional()
  heartRate?: number;

  @ApiPropertyOptional({ example: 36.5 })
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ example: 98 })
  @IsOptional()
  spO2?: number;

  @ApiPropertyOptional({ example: 65.5 })
  @IsOptional()
  weightKg?: number;

  @ApiPropertyOptional({ example: 170 })
  @IsOptional()
  heightCm?: number;

  @ApiPropertyOptional({ example: 22.5 })
  @IsOptional()
  bmi?: number;

  @ApiPropertyOptional({ description: 'Visit-specific medical history' })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @ApiPropertyOptional({ description: 'Visit-specific allergies' })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ description: 'Additional symptoms' })
  @IsOptional()
  @IsString()
  additionalSymptoms?: string;

  @ApiPropertyOptional({
    description: 'Preparation instructions / follow-up note',
  })
  @IsOptional()
  @IsString()
  followUpNote?: string;
}
