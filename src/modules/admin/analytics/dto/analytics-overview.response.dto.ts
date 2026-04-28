import { ApiProperty } from '@nestjs/swagger';

export class DashboardOverviewTrendsDto {
  @ApiProperty({ example: 10 })
  newPatientsThisMonth: number;

  @ApiProperty({ example: 8 })
  newPatientsLastMonth: number;

  @ApiProperty({ example: 25 })
  newBookingsThisMonth: number;

  @ApiProperty({ example: 20 })
  newBookingsLastMonth: number;

  @ApiProperty({ example: 15000000 })
  currentMonthRevenue: number;

  @ApiProperty({ example: 12000000 })
  lastMonthRevenue: number;

  @ApiProperty({ example: 25 })
  revenueGrowthPct: number;
}

export class AnalyticsOverviewResponseDto {
  @ApiProperty({ example: 1250 })
  totalUsers: number;

  @ApiProperty({ example: 12 })
  totalDoctors: number;

  @ApiProperty({ example: 3456 })
  totalBookings: number;

  @ApiProperty({ example: 450000000 })
  totalRevenue: number;

  @ApiProperty({ type: DashboardOverviewTrendsDto })
  trends: DashboardOverviewTrendsDto;
}
