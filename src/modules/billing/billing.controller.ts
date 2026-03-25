import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, InvoiceStatus, InvoiceType } from '@prisma/client';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  AddInvoiceItemDto,
  ConfirmPaymentDto,
} from './dto/billing.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Invoice CRUD

  @Post('invoices')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({
    summary:
      'Create DRAFT invoice for a booking (Phương án B: nhiều invoice/booking)',
  })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Delete('invoices/:id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a DRAFT invoice' })
  deleteInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.deleteInvoice(id);
  }

  @Get('invoices')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'List invoices with optional filters' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'invoiceType', required: false, enum: InvoiceType })
  @ApiQuery({ name: 'patientProfileId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listInvoices(
    @Query('status') status?: InvoiceStatus,
    @Query('invoiceType') invoiceType?: InvoiceType,
    @Query('patientProfileId') patientProfileId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.listInvoices({
      status,
      invoiceType,
      patientProfileId,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('invoices/booking/:bookingId')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({
    summary: 'List all invoices for a booking (Phương án B: returns array)',
  })
  listInvoicesByBooking(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.billingService.listInvoicesByBooking(bookingId);
  }

  @Get('invoices/booking/:bookingId/pending-labs')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({
    summary:
      'Get PENDING lab orders for a booking not yet added to any invoice — for billing alert',
  })
  getPendingLabOrdersForBilling(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.billingService.getPendingLabOrdersForBilling(bookingId);
  }

  @Get('invoices/:id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Get invoice by invoice ID' })
  getInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.getInvoiceById(id);
  }

  // Invoice Items

  @Post('invoices/:id/items')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Add extra line item to a DRAFT invoice' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.billingService.addInvoiceItem(id, dto);
  }

  @Delete('invoices/:id/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a line item from a DRAFT invoice' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.billingService.removeInvoiceItem(id, itemId);
  }

  // Payment

  @Post('invoices/:id/payments')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Add payment to invoice. Auto-finalizes (PAID) when total is met.',
  })
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.billingService.addPayment(id, dto, user.id);
  }

  @Get('my-invoices')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'List invoices for the logged-in patient' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listMyInvoices(
    @CurrentUser() user: { id: string },
    @Query('status') status?: InvoiceStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.listMyInvoices(user.id, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
