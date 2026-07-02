import { ApiProperty } from '@nestjs/swagger';

export class MedicineStatsResponseDto {
  @ApiProperty({ example: 450, description: 'Total medicines in catalogue' })
  totalMedicines: number;

  @ApiProperty({ example: 420, description: 'Total active medicines' })
  activeMedicines: number;

  @ApiProperty({ example: 30, description: 'Total inactive medicines' })
  inactiveMedicines: number;

  @ApiProperty({ example: 12, description: 'Medicines with 0 stock quantity' })
  outOfStockMedicines: number;
}
