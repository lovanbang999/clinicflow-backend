import { ApiProperty } from '@nestjs/swagger';

export class MonthlyStatsResponseDto {
  @ApiProperty({
    description: 'The month for these stats (YYYY-MM)',
    example: '2025-03',
  })
  month: string;

  @ApiProperty({
    description: 'Total bookings created this month',
    example: 328,
  })
  bookingCount: number;

  @ApiProperty({
    description: 'New patients registered this month',
    example: 89,
  })
  newPatients: number;

  @ApiProperty({
    description: 'Completion rate — completed / total bookings (%)',
    example: 92,
  })
  successRate: number;

  @ApiProperty({
    description: 'Revenue from completed bookings this month (VND)',
    example: 85600000,
  })
  revenue: number;
}
