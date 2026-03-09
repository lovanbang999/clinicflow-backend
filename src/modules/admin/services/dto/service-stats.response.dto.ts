import { ApiProperty } from '@nestjs/swagger';

export class ServiceStatsResponseDto {
  @ApiProperty({ example: 24 })
  totalServices: number;

  @ApiProperty({ example: 22 })
  activeServices: number;

  @ApiProperty({ example: 2 })
  inactiveServices: number;

  @ApiProperty({ example: 3 })
  newThisMonth: number;

  @ApiProperty({
    description: 'Service with the most completed bookings',
    nullable: true,
    example: { id: 'uuid', name: 'General Checkup', bookingCount: 152 },
  })
  mostBooked: { id: string; name: string; bookingCount: number } | null;
}
