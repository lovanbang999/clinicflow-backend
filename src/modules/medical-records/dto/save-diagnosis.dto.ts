import {
  IsDateString,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SaveDiagnosisDto {
  @ApiPropertyOptional({ description: 'ICD-10 code e.g. "M54.5"' })
  @IsOptional()
  @IsString()
  diagnosisCode?: string;

  @ApiPropertyOptional({ description: 'Human-readable diagnosis name' })
  @IsOptional()
  @IsString()
  diagnosisName?: string;

  @ApiPropertyOptional({ description: 'Treatment plan' })
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional({ description: "Doctor's notes" })
  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @ApiPropertyOptional({
    description: 'Follow-up date (ISO date string)',
    example: '2026-04-15',
  })
  @ValidateIf((o: SaveDiagnosisDto) => o.followUpDate !== '')
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional({ description: 'Follow-up instructions' })
  @IsOptional()
  @IsString()
  followUpNote?: string;
}
