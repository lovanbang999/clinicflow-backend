import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminSuspendUserDto {
  @ApiProperty({
    description:
      'Set to false to suspend (deactivate) the user, true to reinstate',
    example: false,
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @ApiProperty({
    description: 'Reason for suspension/reinstate',
    required: false,
    example: 'Violated terms of service',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
