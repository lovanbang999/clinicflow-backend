import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';

/**
 * DTO for PATCH /admin/doctors/:id/profile
 * Updates fields on the DoctorProfile table (not User table).
 */
export class AdminUpdateDoctorProfileDto {
  @ApiProperty({
    description: 'List of specialties',
    example: ['Cardiology', 'Internal Medicine'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiProperty({
    description: 'List of qualifications / degrees',
    example: ['MD', 'PhD', 'FACC'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];

  @ApiProperty({
    description: 'Years of clinical experience',
    example: 10,
    required: false,
    minimum: 0,
    maximum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @ApiProperty({
    description: 'Short professional bio',
    example: 'Specialist in interventional cardiology with 10+ years...',
    required: false,
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'Override rating (0-5, admin correction)',
    example: 4.8,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiProperty({
    description: 'Consultation fee for this doctor',
    example: 150000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @ApiProperty({
    description: 'List of assigned service IDs',
    example: ['service-uuid-1', 'service-uuid-2'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @ApiProperty({
    description: 'Default consultation room UUID for the doctor',
    example: 'room-uuid-1',
    required: false,
  })
  @IsOptional()
  @IsString()
  roomId?: string | null;
}
