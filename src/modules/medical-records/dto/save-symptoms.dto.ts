import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SaveSymptomsDto {
  @ApiPropertyOptional({ description: 'Chief complaint / Lý do khám' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({
    description: 'Clinical findings / Kết quả thăm khám lâm sàng',
  })
  @IsOptional()
  @IsString()
  clinicalFindings?: string;

  @ApiPropertyOptional({ description: "Doctor's notes" })
  @IsOptional()
  @IsString()
  doctorNotes?: string;
}
