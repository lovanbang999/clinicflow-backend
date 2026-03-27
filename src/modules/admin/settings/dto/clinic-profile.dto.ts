import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateClinicProfileDto {
  @ApiPropertyOptional({ example: 'SmartClinic Central' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '123 Healthcare St, Medical City' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@smartclinic.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'MST-987654321' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: 'https://cdn.smartlink.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}
