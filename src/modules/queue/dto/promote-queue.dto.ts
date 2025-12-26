import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class PromoteQueueDto {
  @ApiProperty({
    description: 'Booking ID to promote from queue',
    example: 'uuid-booking-id',
  })
  @IsUUID('4', { message: 'Invalid booking ID format' })
  bookingId: string;

  @ApiProperty({
    description: 'Reason for manual promotion (optional)',
    example: 'Emergency case',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
