import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateNotificationConfigDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enableEmailReminders?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  enableSmsReminders?: boolean;

  @ApiPropertyOptional({
    example: '24h,1h',
    description: 'Comma-separated hours before appointment to remind',
  })
  @IsOptional()
  @IsString()
  reminderSchedule?: string;

  @ApiPropertyOptional({ example: 'smtp.gmail.com' })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ example: '587' })
  @IsOptional()
  @IsString()
  smtpPort?: string;
}
