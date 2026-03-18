import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PatientSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Search term (name, email, phone, or insurance number)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by gender — comma-separated values (MALE, FEMALE, OTHER). ' +
      'Example: gender=MALE,FEMALE',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description:
      'Filter by patient status — comma-separated values (active, inactive). ' +
      'Example: status=active',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Filter by blood type — comma-separated values. ' +
      'Example: bloodType=A%2B,O%2B  (URL-encode the + sign)',
  })
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional({
    description: 'Filter by patient code (e.g. BN-2026-0001)',
  })
  @IsOptional()
  @IsString()
  patientCode?: string;

  @ApiPropertyOptional({
    description: 'Filter guest patients only (true) or registered only (false)',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isGuest?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}
