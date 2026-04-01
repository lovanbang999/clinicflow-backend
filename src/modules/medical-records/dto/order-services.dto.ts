import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OrderServicesDto {
  @ApiProperty({
    type: [String],
    description: 'Array of Service IDs to order for this visit (B2)',
    example: ['uuid-service-1', 'uuid-service-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}
