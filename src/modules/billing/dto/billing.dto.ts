import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, InvoiceType, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Booking ID to create invoice for' })
  @IsUUID()
  bookingId: string;

  @ApiPropertyOptional({
    enum: InvoiceType,
    default: InvoiceType.CONSULTATION,
    description:
      'Type of invoice: CONSULTATION (Examination) | LAB (Laboratory) | PHARMACY (Pharmacy)',
  })
  @IsEnum(InvoiceType)
  @IsOptional()
  invoiceType?: InvoiceType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional list of lab order IDs to include',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  labOrderIds?: string[];

  @ApiPropertyOptional({
    type: () => [AddInvoiceItemDto],
    description: 'Optional extra items to add manually',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddInvoiceItemDto)
  @IsOptional()
  items?: AddInvoiceItemDto[];
}

export class AddInvoiceItemDto {
  @ApiPropertyOptional({ description: 'Optional: link to an existing service' })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Optional: link to a lab order' })
  @IsUUID()
  @IsOptional()
  labOrderId?: string;

  @ApiProperty({ example: 'Khám tổng quát' })
  @IsString()
  itemName: string;

  @ApiProperty({ type: Number, example: 150000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ type: Number, example: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}

export class ConfirmPaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ type: Number, description: 'Total amount paid (VND)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amountPaid: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Insurance covered portion',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  insuranceCovered?: number;

  @ApiPropertyOptional({
    description: 'Bank transaction reference / insurance code',
  })
  @IsString()
  @IsOptional()
  transactionRef?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  insuranceNumber?: string;

  @ApiPropertyOptional({ description: 'Link payment to a specific lab order' })
  @IsUUID()
  @IsOptional()
  labOrderId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
