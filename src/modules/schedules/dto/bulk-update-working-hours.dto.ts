import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';

export class BulkWorkingHoursItemDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '08:00' })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  endTime: string;

  @ApiProperty({
    description: 'If false, this day will be deleted',
    default: true,
  })
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
