import { ApiProperty } from '@nestjs/swagger';

export class TopServiceDto {
  @ApiProperty({ example: 'svc-123' })
  id: string;

  @ApiProperty({ example: 'General Consultation' })
  name: string;

  @ApiProperty({ example: 42 })
  bookingsCount: number;

  @ApiProperty({ example: 1500000 })
  estimatedRevenue: number;
}

export class TopServicesResponseDto {
  @ApiProperty({ type: [TopServiceDto] })
  topServices: TopServiceDto[];
}
