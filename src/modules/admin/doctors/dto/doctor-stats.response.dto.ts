import { ApiProperty } from '@nestjs/swagger';

export class DoctorStatsResponseDto {
  @ApiProperty({ example: 148 })
  totalDoctors: number;

  @ApiProperty({ example: 92 })
  activeDoctors: number;

  @ApiProperty({ example: 56 })
  inactiveDoctors: number;

  @ApiProperty({ example: 12 })
  onLeaveDoctors: number;

  @ApiProperty({
    example: 8,
    description: 'Doctors created this month (new applications)',
  })
  newThisMonth: number;

  @ApiProperty({
    example: { Cardiology: 12, Neurology: 8 },
    description: 'Count of active doctors per specialty',
  })
  bySpecialty: Record<string, number>;
}
