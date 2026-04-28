import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { SpecialistFindings } from '../../visit-service-orders/types/specialist-findings.types';

export class CompleteSpecialistExamDto {
  @ApiProperty({ description: 'Result of specialist exam (Eye, Dental, ...)' })
  @IsString()
  @IsNotEmpty()
  resultText: string;

  @ApiPropertyOptional({ description: 'Additional notes from specialist' })
  @IsString()
  @IsOptional()
  doctorNotes?: string;

  @ApiPropertyOptional({ description: 'Assessment of abnormality' })
  @IsBoolean()
  @IsOptional()
  isAbnormal?: boolean;

  @ApiPropertyOptional({ description: 'Note about abnormality' })
  @IsString()
  @IsOptional()
  abnormalNote?: string;

  @ApiPropertyOptional({ description: 'Structural specialist exam results' })
  @IsObject()
  @IsOptional()
  findings?: SpecialistFindings;
}
