import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsISO8601 } from 'class-validator';

export class DateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in ISO format',
    example: '2024-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date in ISO format',
    example: '2024-03-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
