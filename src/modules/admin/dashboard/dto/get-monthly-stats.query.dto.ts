import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class GetMonthlyStatsQueryDto {
  @ApiPropertyOptional({
    description:
      'Target month in YYYY-MM format. Defaults to the current month.',
    example: '2025-03',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format (e.g. "2025-03")',
  })
  month?: string;
}
