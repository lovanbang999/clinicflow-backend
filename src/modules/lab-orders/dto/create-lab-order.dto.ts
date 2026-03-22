import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLabOrderDto {
  @ApiProperty({
    description: 'Booking ID',
    example: 'uuid-booking-id',
  })
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({
    description: 'Name of the test',
    example: 'Xét nghiệm máu tổng quát (CBC)',
  })
  @IsString()
  @IsNotEmpty()
  testName: string;

  @ApiProperty({
    description: 'Description or notes for the test',
    example: 'Chú ý đường huyết',
    required: false,
  })
  @IsString()
  @IsOptional()
  testDescription?: string;

  @ApiPropertyOptional({
    description: 'Link strictly to a service catalog item for billing',
  })
  @IsString()
  @IsOptional()
  serviceId?: string;
}
