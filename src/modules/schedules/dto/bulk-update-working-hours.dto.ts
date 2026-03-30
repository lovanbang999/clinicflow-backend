import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsEnum,
  IsString,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';

export class BulkWorkingHoursItemDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiProperty({
    description: 'If false, this day will be deleted',
    default: true,
  })
  @IsBoolean()
  enabled: boolean;
}

export class BulkUpdateWorkingHoursDto {
  @ApiProperty({ description: 'Doctor ID' })
  @IsUUID('4')
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ type: [BulkWorkingHoursItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkWorkingHoursItemDto)
  items: BulkWorkingHoursItemDto[];
}
