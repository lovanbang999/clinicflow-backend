import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { DateRangeQueryDto } from './date-range.query.dto';

export class GetRevenueChartQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    description:
      'Number of past months to include in the chart. Ignored if from/to or period is provided.',
    default: 6,
    minimum: 1,
    maximum: 24,
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;

  @ApiPropertyOptional({
    description: 'Time period for the chart (week, month, quarter)',
    enum: ['week', 'month', 'quarter'],
    example: 'month',
  })
  @IsOptional()
  @IsIn(['week', 'month', 'quarter'])
  period?: 'week' | 'month' | 'quarter';
}
