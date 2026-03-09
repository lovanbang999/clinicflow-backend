import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetRevenueChartQueryDto {
  @ApiPropertyOptional({
    description: 'Number of past months to include in the chart',
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
  months?: number = 6;
}
