import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class PrescriptionItemDto {
  @ApiProperty({
    description: 'Name of the medicine',
    example: 'Paracetamol',
  })
  @IsString()
  @IsNotEmpty()
  medicineName: string;

  @ApiProperty({
    description: 'Dosage instructions',
    example: '500mg',
  })
  @IsString()
  @IsNotEmpty()
  dosage: string;

  @ApiProperty({
    description: 'Frequency of intake',
    example: '3 times per day',
  })
  @IsString()
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({
    description: 'Duration of treatment in days',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @ApiProperty({
    description: 'Total quantity prescribed',
    example: 15,
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Unit of measure',
    example: 'tablets',
    default: 'viên',
  })
  @IsString()
  unit: string;

  @ApiProperty({
    description: 'Special instructions for the patient',
    example: 'Take after meals',
    required: false,
  })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateMedicalRecordDto {
  @ApiProperty({
    description: 'Linked Booking ID',
    example: 'uuid-booking-id',
  })
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({
    description: 'Chief complaint (Reason for visit)',
    example: 'Fever and sore throat for 2 days',
    required: false,
  })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiProperty({
    description: 'Clinical findings from the examination',
    example: 'Temperature 38.5°C, inflamed tonsils',
    required: false,
  })
  @IsOptional()
  @IsString()
  clinicalFindings?: string;

  @ApiProperty({
    description: 'ICD-10 Diagnosis Code',
    example: 'J03.9',
    required: false,
  })
  @IsOptional()
  @IsString()
  diagnosisCode?: string;

  @ApiProperty({
    description: 'ICD-10 Diagnosis Name',
    example: 'Acute tonsillitis, unspecified',
    required: false,
  })
  @IsOptional()
  @IsString()
  diagnosisName?: string;

  @ApiProperty({
    description: 'Proposed treatment plan',
    example: 'Rest, increased fluids, and antibiotic course',
    required: false,
  })
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiProperty({
    description: 'Internal notes for the doctor',
    example: 'Monitor for secondary infections',
    required: false,
  })
  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @ApiProperty({
    description: 'Suggested follow-up date (YYYY-MM-DD)',
    example: '2024-12-30',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiProperty({
    description: 'Follow-up instructions or notes',
    example: 'Return if fever persists after 48h',
    required: false,
  })
  @IsOptional()
  @IsString()
  followUpNote?: string;

  @ApiProperty({
    description: 'Flag to mark the consultation as finalized',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isFinalized?: boolean;

  @ApiProperty({
    description:
      'Flag to complete the corresponding booking visit within the same transaction',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  completeVisit?: boolean;

  @ApiProperty({
    description: 'List of prescribed medicines',
    type: [PrescriptionItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  prescriptionItems?: PrescriptionItemDto[];
}
