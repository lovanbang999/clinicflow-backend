import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompleteSpecialistExamDto {
  @ApiProperty({ description: 'Kết quả khám chuyên khoa (Mắt, Răng, ...)' })
  @IsString()
  @IsNotEmpty()
  resultText: string;

  @ApiPropertyOptional({ description: 'Ghi chú thêm của bác sĩ chuyên khoa' })
  @IsString()
  @IsOptional()
  doctorNotes?: string;

  @ApiPropertyOptional({ description: 'Đánh giá có bất thường hay không' })
  @IsBoolean()
  @IsOptional()
  isAbnormal?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú về sự bất thường' })
  @IsString()
  @IsOptional()
  abnormalNote?: string;
}
