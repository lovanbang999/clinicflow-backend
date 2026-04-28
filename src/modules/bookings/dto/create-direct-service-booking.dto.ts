import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { BookingPriority } from '@prisma/client';

/**
 * DTO for Mode B — "Đặt thẳng dịch vụ" walk-in.
 *
 * Luồng B3→B4: Bệnh nhân đã biết cần xét nghiệm/chuyên khoa gì.
 * Lễ tân chọn dịch vụ + BS phụ trách ca → tạo booking + MedicalRecord rút gọn
 * (visitStep=SERVICES_ORDERED) + LabOrder/VisitServiceOrder[] + Invoice LAB DRAFT.
 * KHÔNG tạo CONSULTATION invoice. KHÔNG qua B2 tư vấn.
 */
export class CreateDirectServiceBookingDto {
  @ApiProperty({
    description: 'Patient Profile ID',
    example: 'uuid-patient-profile-id',
  })
  @IsUUID('4')
  patientProfileId: string;

  @ApiProperty({
    description:
      'Doctor who is responsible for the case — responsible for legal liability and signing documents. The patient does not necessarily have to meet in person.',
    example: 'uuid-doctor-id',
  })
  @IsUUID('4')
  doctorId: string;

  @ApiProperty({
    description:
      'List of service IDs to be performed (laboratory or specialized clinics). Minimum 1.',
    example: ['uuid-service-1', 'uuid-service-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one service must be selected' })
  @IsUUID('4', { each: true })
  serviceIds: string[];

  @ApiProperty({
    description:
      'List of specialist doctors assigned to each service (only for DOCTOR performer type services)',
    required: false,
    type: 'array',
    items: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
        performingDoctorId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @IsOptional()
  @IsArray()
  serviceAssignments?: { serviceId: string; performingDoctorId: string }[];

  @ApiProperty({
    description: 'Booking date (YYYY-MM-DD)',
    example: '2026-04-22',
  })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({
    description: 'Walk-in (false) or pre-booked (true). Default: false.',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPreBooked?: boolean;

  @ApiProperty({
    description: 'Start time — only required when isPreBooked=true',
    example: '09:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format. Use HH:mm (24-hour)',
  })
  startTime?: string;

  @ApiProperty({
    description: 'Priority level',
    enum: BookingPriority,
    required: false,
    default: BookingPriority.NORMAL,
  })
  @IsOptional()
  priority?: BookingPriority;

  @ApiProperty({
    description: 'Optional patient notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  patientNotes?: string;
}
