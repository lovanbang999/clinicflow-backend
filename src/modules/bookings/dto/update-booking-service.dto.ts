import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateBookingServiceDto {
  @ApiProperty({
    description:
      'Service ID — BS tư vấn xác định dịch vụ chuyên khoa sau khi hỏi thăm bệnh nhân',
    example: 'uuid-service-id',
  })
  @IsUUID('4', { message: 'Invalid service ID format' })
  serviceId: string;
}
