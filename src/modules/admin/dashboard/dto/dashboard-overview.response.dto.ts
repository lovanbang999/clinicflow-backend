import { ApiProperty } from '@nestjs/swagger';

export class DashboardTrendsDto {
  @ApiProperty({
    description: 'New patients registered this month',
    example: 89,
  })
  newPatientsThisMonth: number;

  @ApiProperty({
    description: 'New patients registered last month',
    example: 74,
  })
  newPatientsLastMonth: number;

  @ApiProperty({ description: 'New bookings created this month', example: 328 })
  newBookingsThisMonth: number;

  @ApiProperty({ description: 'New bookings created last month', example: 310 })
  newBookingsLastMonth: number;

  @ApiProperty({
    description: 'Total revenue from completed bookings this month (VND)',
    example: 85600000,
  })
  currentMonthRevenue: number;

  @ApiProperty({
    description: 'Total revenue from completed bookings last month (VND)',
    example: 72000000,
  })
  lastMonthRevenue: number;

  @ApiProperty({
    description: 'Revenue growth percentage vs last month',
    example: 18,
  })
  revenueGrowthPct: number;
}

export class DashboardOverviewResponseDto {
  @ApiProperty({ description: 'Total active patients', example: 1234 })
  totalUsers: number;

  @ApiProperty({ description: 'Total active doctors', example: 12 })
  totalDoctors: number;

  @ApiProperty({ description: 'Total bookings (all time)', example: 3456 })
  totalBookings: number;

  @ApiProperty({
    description: 'Total revenue from all completed bookings (VND)',
    example: 420000000,
  })
  totalRevenue: number;

  @ApiProperty({ type: () => DashboardTrendsDto })
  trends: DashboardTrendsDto;
}
