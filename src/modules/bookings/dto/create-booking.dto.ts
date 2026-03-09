import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Patient ID',
    example: 'uuid-patient-id',
  })
  @IsUUID('4', { message: 'Invalid patient ID format' })
  patientId: string;

  @ApiProperty({
    description: 'Doctor ID',
    example: 'uuid-doctor-id',
  })
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctorId: string;

  @ApiProperty({
    description: 'Service ID',
    example: 'uuid-service-id',
  })
  @IsUUID('4', { message: 'Invalid service ID format' })
  serviceId: string;

  @ApiProperty({
    description: 'Booking date (YYYY-MM-DD)',
    example: '2024-12-25',
  })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  bookingDate: string;

  @ApiProperty({
    description: 'Start time (HH:mm format)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format. Use HH:mm (24-hour)',
  })
  startTime: string;

  @ApiProperty({
    description: 'Patient notes (optional)',
    example: 'I have symptoms of...',
    required: false,
  })
  @IsOptional()
  @IsString()
  patientNotes?: string;
}
