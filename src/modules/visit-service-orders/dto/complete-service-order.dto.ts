import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SpecialistFindings } from '../types/specialist-findings.types';

export class CompleteServiceOrderDto {
  @ApiPropertyOptional({
    description: 'Result text / findings from the procedure',
  })
  @IsOptional()
  @IsString()
  resultText?: string;

  @ApiPropertyOptional({ description: 'URL of uploaded result file' })
  @IsOptional()
  @IsString()
  resultFileUrl?: string;

  @ApiPropertyOptional({ description: 'Whether the result is abnormal' })
  @IsOptional()
  @IsBoolean()
  isAbnormal?: boolean;

  @ApiPropertyOptional({ description: 'Note explaining the abnormality' })
  @IsOptional()
  @IsString()
  abnormalNote?: string;

  @ApiPropertyOptional({
    description: 'Structured specialist examination findings',
  })
  @IsOptional()
  findings?: SpecialistFindings;
}
