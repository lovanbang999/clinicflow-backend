import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class UpdateBookingServiceDto {
  @ApiProperty({
    description:
      'Service ID — BS tư vấn xác định dịch vụ chuyên khoa sau khi hỏi thăm bệnh nhân',
    example: 'uuid-service-id',
  })
  @IsUUID('4', { message: 'Invalid service ID format' })
  serviceId: string;

  @ApiProperty({
    description:
      'Doctor ID — BS tư vấn chỉ định bác sĩ khám chuyên khoa phù hợp',
    example: 'uuid-doctor-id',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctorId?: string;
}
