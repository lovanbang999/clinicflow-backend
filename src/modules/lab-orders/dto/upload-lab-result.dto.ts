import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UploadLabResultDto {
  @ApiProperty({
    description: 'Text version of the result',
    example: 'Hồng cầu bình thường, bạch cầu hơi cao.',
    required: false,
  })
  @IsString()
  @IsOptional()
  resultText?: string;

  @ApiProperty({
    description: 'URL to the uploaded result file (PDF/Image)',
    example: 'https://res.cloudinary.com/xyz',
    required: false,
  })
  @IsString()
  @IsOptional()
  resultFileUrl?: string;

  @ApiProperty({
    description: 'Flag to mark if the result is abnormal',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isAbnormal?: boolean;

  @ApiProperty({
    description: 'Note explaining the abnormal result',
    example: 'Bạch cầu tăng nhẹ (12.000)',
    required: false,
  })
  @IsString()
  @IsOptional()
  abnormalNote?: string;
}
