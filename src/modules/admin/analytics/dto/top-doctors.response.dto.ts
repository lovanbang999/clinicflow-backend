import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopDoctorItemDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @ApiProperty({ example: 'Cardiology' })
  specialty: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar.jpg',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Number of visits/patients in period',
    example: 156,
  })
  patientsCount: number;

  @ApiProperty({
    description: 'Total revenue from this doctor in period',
    example: 15000000,
  })
  revenue: number;
}

export class TopDoctorsResponseDto {
  @ApiProperty({ type: () => [TopDoctorItemDto] })
  topDoctors: TopDoctorItemDto[];
}
