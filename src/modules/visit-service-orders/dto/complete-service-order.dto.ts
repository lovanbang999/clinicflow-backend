import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
