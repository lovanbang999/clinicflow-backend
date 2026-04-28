import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CancelBookingDto {
  @ApiProperty({
    description: 'Reason for cancellation (required)',
    example: 'Tôi có việc bận đột xuất, không thể đến khám đúng hẹn được.',
    minLength: 10,
  })
  @IsNotEmpty({ message: 'Reason for cancellation is required' })
  @IsString()
  @MinLength(10, {
    message: 'Please provide a more detailed reason (at least 10 characters)',
  })
  reason: string;
}
