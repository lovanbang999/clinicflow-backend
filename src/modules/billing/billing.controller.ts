import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
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
import { UserRole, InvoiceStatus, InvoiceType, User } from '@prisma/client';
import { Response } from 'express';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  AddInvoiceItemDto,
  ConfirmPaymentDto,
} from './dto/billing.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { MessageCodes } from '../../common/constants/message-codes.const';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('workspace-kpis')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ResponseMessage(
    MessageCodes.BILLING_KPIS_RETRIEVED,
    'Workspace KPIs retrieved successfully',
  )
  @ApiOperation({
    summary: "Get today's financial KPIs for receptionist workspace",
  })
  getWorkspaceKpis() {
    return this.billingService.getWorkspaceKpis();
  }

  @Get('workspace-queue')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ResponseMessage(
    MessageCodes.BILLING_QUEUE_RETRIEVED,
    'Workspace queue retrieved successfully',
  )
  @ApiOperation({ summary: 'Get patient billing queue for workspace' })
  @ApiQuery({ name: 'search', required: false })
  getWorkspaceQueue(@Query('search') search?: string) {
    return this.billingService.getWorkspaceQueue({ search });
  }

  // Invoice CRUD

  @Post('invoices')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ResponseMessage(MessageCodes.INVOICE_CREATED, 'Invoice created successfully')
  @ApiOperation({
    summary:
      'Create DRAFT invoice for a booking (Phương án B: nhiều invoice/booking)',
  })
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: User) {
    return this.billingService.createInvoice(dto, user);
  }

  @Delete('invoices/:id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(MessageCodes.INVOICE_DELETED, 'Invoice deleted successfully')
  @ApiOperation({ summary: 'Delete a DRAFT invoice' })
  deleteInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.billingService.deleteInvoice(id, user);
  }

  @Get('invoices')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ResponseMessage(
    MessageCodes.INVOICES_RETRIEVED,
    'Invoices list retrieved successfully',
  )
  @ApiOperation({ summary: 'List invoices with optional filters' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'invoiceType', required: false, enum: InvoiceType })
  @ApiQuery({ name: 'patientProfileId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listInvoices(
    @Query('status') status?: InvoiceStatus,
    @Query('invoiceType') invoiceType?: InvoiceType,
    @Query('patientProfileId') patientProfileId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: User,
  ) {
    return this.billingService.listInvoices({
      status,
      invoiceType,
      patientProfileId,
      startDate,
      endDate,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      currentUser: user as User,
    });
  }

  @Get('invoices/booking/:bookingId')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.PATIENT,
  )
  @ResponseMessage(
    MessageCodes.INVOICES_RETRIEVED,
    'Booking invoices list retrieved successfully',
  )
  @ApiOperation({
    summary: 'List all invoices for a booking (Phương án B: returns array)',
  })
  listInvoicesByBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: User,
  ) {
    return this.billingService.listInvoicesByBooking(bookingId, user);
  }

  @Get('invoices/booking/:bookingId/pending-labs')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ResponseMessage(
    MessageCodes.PENDING_LAB_ORDERS_FOR_BILLING_RETRIEVED,
    'Pending lab orders retrieved successfully',
  )
  @ApiOperation({
    summary:
      'Get PENDING lab orders for a booking not yet added to any invoice — for billing alert',
  })
  getPendingLabOrdersForBilling(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.billingService.getPendingLabOrdersForBilling(bookingId);
  }

  @Get('invoices/export')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Export invoices as CSV' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'invoiceType', required: false, enum: InvoiceType })
  @ApiQuery({ name: 'patientProfileId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  async exportInvoices(
    @Res() res: Response,
    @Query('status') status?: InvoiceStatus,
    @Query('invoiceType') invoiceType?: InvoiceType,
    @Query('patientProfileId') patientProfileId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: User,
  ) {
    const csvContent = await this.billingService.exportInvoicesToCsv({
      status,
      invoiceType,
      patientProfileId,
      startDate,
      endDate,
      search,
      currentUser: user,
    });

    const filename = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.write('\ufeff');
    res.write(csvContent);
    res.end();
  }

  @Get('invoices/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.PATIENT,
  )
  @ResponseMessage(
    MessageCodes.INVOICE_RETRIEVED,
    'Invoice retrieved successfully',
  )
  @ApiOperation({ summary: 'Get invoice by invoice ID' })
  getInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.billingService.getInvoiceById(id, user);
  }

  // Invoice Items

  @Post('invoices/:id/items')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ResponseMessage(
    MessageCodes.INVOICE_ITEM_ADDED,
    'Item added to invoice successfully',
  )
  @ApiOperation({ summary: 'Add extra line item to a DRAFT invoice' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
    @CurrentUser() user: User,
  ) {
    return this.billingService.addInvoiceItem(id, dto, user);
  }

  @Delete('invoices/:id/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    MessageCodes.INVOICE_ITEM_REMOVED,
    'Item removed from invoice successfully',
  )
  @ApiOperation({ summary: 'Remove a line item from a DRAFT invoice' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: User,
  ) {
    return this.billingService.removeInvoiceItem(id, itemId, user);
  }

  // Payment

  @Post('invoices/:id/payments')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ResponseMessage(MessageCodes.PAYMENT_ADDED, 'Payment processed successfully')
  @ApiOperation({
    summary: 'Add payment to invoice. Auto-finalizes (PAID) when total is met.',
  })
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.billingService.addPayment(id, dto, user.id, user);
  }

  @Get('my-invoices')
  @Roles(UserRole.PATIENT)
  @ResponseMessage(
    MessageCodes.INVOICES_RETRIEVED,
    'Your invoices list retrieved successfully',
  )
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
