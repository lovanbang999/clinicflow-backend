import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  @ApiProperty({
    description: 'New booking status',
    enum: BookingStatus,
    example: BookingStatus.CONFIRMED,
  })
  @IsEnum(BookingStatus, { message: 'Invalid booking status' })
  status: BookingStatus;

  @ApiProperty({
    description: 'Reason for status change (optional)',
    example: 'Patient requested cancellation',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Doctor notes (optional)',
    example: 'Patient checked in early',
    required: false,
  })
  @IsOptional()
  @IsString()
  doctorNotes?: string;
}
