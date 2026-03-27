import { ApiProperty } from '@nestjs/swagger';

export class RevenueChartPointDto {
  @ApiProperty({
    description: 'First day of the month or specific date (YYYY-MM-DD)',
    example: '2025-03-01',
  })
  date: string;

  @ApiProperty({
    description: 'Total revenue for that point (VND)',
    example: 85600000,
  })
  revenue: number;
}

export class RevenueChartResponseDto {
  @ApiProperty({
    description: 'Time period for the chart (week, month, quarter)',
    enum: ['week', 'month', 'quarter'],
    example: 'month',
  })
  period: string;

  @ApiProperty({
    description: 'Number of months included in the chart (if applicable)',
    example: 6,
    required: false,
  })
  months?: number;

  @ApiProperty({ type: () => [RevenueChartPointDto] })
  chart: RevenueChartPointDto[];
}
