import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class AdminSuspendUserDto {
  @ApiProperty({
    description:
      'Set to false to suspend (deactivate) the user, true to reinstate',
    example: false,
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
