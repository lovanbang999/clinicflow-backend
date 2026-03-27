import { ApiProperty } from '@nestjs/swagger';

export class BookingOverviewResponseDto {
  @ApiProperty({ description: 'Total bookings (all statuses)', example: 3456 })
  total: number;

  @ApiProperty({ description: 'Completed bookings', example: 2350 })
  completed: number;

  @ApiProperty({
    description: 'Upcoming bookings (PENDING/CONFIRMED with future date)',
    example: 760,
  })
  upcoming: number;

  @ApiProperty({ description: 'Cancelled bookings', example: 346 })
  cancelled: number;

  @ApiProperty({
    description: 'In-progress bookings (CHECKED_IN/IN_PROGRESS)',
    example: 12,
  })
  inProgress: number;

  @ApiProperty({
    description: 'Completed percentage of total (%)',
    example: 68,
  })
  completedPct: number;

  @ApiProperty({ description: 'Upcoming percentage of total (%)', example: 22 })
  upcomingPct: number;

  @ApiProperty({
    description: 'Cancelled percentage of total (%)',
    example: 10,
  })
  cancelledPct: number;
}
