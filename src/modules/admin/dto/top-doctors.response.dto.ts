import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopDoctorItemDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar.jpg',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({ description: 'Number of completed bookings', example: 156 })
  visitCount: number;
}

export class TopDoctorsResponseDto {
  @ApiProperty({ type: () => [TopDoctorItemDto] })
  topDoctors: TopDoctorItemDto[];
}
