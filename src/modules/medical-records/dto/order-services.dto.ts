import { IsArray, IsUUID, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderServiceItem {
  @ApiProperty({
    description: 'Service ID to order',
    example: 'uuid-service-1',
  })
  @IsUUID()
  serviceId: string;

  @ApiProperty({
    description: 'Specific doctor UserId to perform this service (optional)',
    example: 'uuid-doctor-1',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  performedBy?: string;
}

export class OrderServicesDto {
  @ApiProperty({
    type: [OrderServiceItem],
    description: 'List of services with optional assigned doctors',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderServiceItem)
  items: OrderServiceItem[];
}
