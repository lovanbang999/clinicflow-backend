import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiProperty({
    description: 'Doctor ID',
    example: 'uuid-doctor-id',
  })
  @IsUUID('4')
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({
    description: 'Service ID',
    example: 'uuid-service-id',
  })
  @IsUUID('4')
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    description: 'Date (YYYY-MM-DD)',
    example: '2024-12-26',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description:
      'Patient ID (optional) - to exclude slots already booked by this patient',
    example: 'uuid-patient-id',
    required: false,
  })
  @IsUUID('4')
  @IsOptional()
  patientId?: string;
}
