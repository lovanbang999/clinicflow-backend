import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({ example: 'Phòng khám 101' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: RoomType, default: RoomType.CONSULTATION })
  @IsEnum(RoomType)
  @IsOptional()
  type?: RoomType;

  @ApiPropertyOptional({ example: '1' })
  @IsString()
  @IsOptional()
  floor?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 'Phòng khám nội tổng quát' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
