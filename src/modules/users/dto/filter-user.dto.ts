import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole } from '@prisma/client';

export const USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'fullName',
  'email',
  'role',
  'isActive',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class FilterUserDto {
  @ApiProperty({
    description: 'Filter by role',
    enum: UserRole,
    required: false,
    example: UserRole.DOCTOR,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    description: 'Filter by active status',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = (obj as Record<string, unknown>)[key];
    return value === 'true' || value === true;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Filter by verified status',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = (obj as Record<string, unknown>)[key];
    return value === 'true' || value === true;
  })
  @IsBoolean()
  isVerified?: boolean;

  @ApiProperty({
    description: 'Search by name, email, or phone',
    required: false,
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) =>
    value === undefined ? undefined : parseInt(String(value), 10),
  )
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) =>
    value === undefined ? undefined : parseInt(String(value), 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Field to sort by',
    required: false,
    enum: USER_SORT_FIELDS,
    example: 'fullName',
  })
  @IsOptional()
  @IsString()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField = 'createdAt';

  @ApiProperty({
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
