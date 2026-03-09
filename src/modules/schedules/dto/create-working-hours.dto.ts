import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsString, Matches, IsNotEmpty } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class CreateWorkingHoursDto {
  @ApiProperty({
    description: 'Doctor ID',
    example: 'uuid-doctor-id',
  })
  @IsUUID('4')
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({
    description: 'Day of week',
    enum: DayOfWeek,
    example: DayOfWeek.MONDAY,
  })
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;

  @ApiProperty({
    description: 'Start time (HH:mm format)',
    example: '09:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time (HH:mm format)',
    example: '17:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:mm format',
  })
  endTime: string;
}
