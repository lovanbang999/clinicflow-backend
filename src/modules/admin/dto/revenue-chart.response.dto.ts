import { ApiProperty } from '@nestjs/swagger';

export class RevenueChartPointDto {
  @ApiProperty({
    description: 'First day of the month (YYYY-MM-01)',
    example: '2025-03-01',
  })
  date: string;

  @ApiProperty({
    description: 'Total revenue for that month (VND)',
    example: 85600000,
  })
  revenue: number;
}

export class RevenueChartResponseDto {
  @ApiProperty({
    description: 'Number of months included in the chart',
    example: 6,
  })
  months: number;

  @ApiProperty({ type: () => [RevenueChartPointDto] })
  chart: RevenueChartPointDto[];
}
