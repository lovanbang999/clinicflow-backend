import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: string }) => {
    const val = parseInt(value, 10);
    return isNaN(val) || val < 1 ? 1 : val;
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (default: 10, max: 100)',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: string }) => {
    const val = parseInt(value, 10);
    if (isNaN(val) || val < 1) return 10;
    return val > 100 ? 100 : val;
  })
  limit?: number = 10;
}
