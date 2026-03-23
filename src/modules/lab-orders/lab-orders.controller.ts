import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { LabOrdersService } from './lab-orders.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UploadLabResultDto } from './dto/upload-lab-result.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { LabOrderStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('lab-orders')
@Controller('lab-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class LabOrdersController {
  constructor(private readonly labOrdersService: LabOrdersService) {}

  @Post()
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new lab order' })
  @ApiResponse({ status: 201, description: 'Lab order created successfully' })
  createOrder(
    @CurrentUser('id') doctorId: string,
    @Body() createLabOrderDto: CreateLabOrderDto,
  ) {
    return this.labOrdersService.createOrder(doctorId, createLabOrderDto);
  }

  @Get('booking/:id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get lab orders for a specific booking' })
  getOrdersByBooking(@Param('id') bookingId: string) {
    return this.labOrdersService.getOrdersByBooking(bookingId);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Get all PENDING lab orders (chưa thu tiền)' })
  getPendingOrders() {
    return this.labOrdersService.getPendingOrders();
  }

  @Get('pending-ready')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Get PAID lab orders (READY TO PERFORM) — for lab technicians',
  })
  getReadyToPerformOrders() {
    return this.labOrdersService.getReadyToPerformOrders();
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Get a single lab order by ID' })
  getOrderById(@Param('id') id: string) {
    return this.labOrdersService.getOrderById(id);
  }

  @Get('booking/:id/pending-unbilled')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({
    summary:
      'Get PENDING lab orders for a booking not yet added to any invoice',
  })
  getPendingUnbilledOrders(@Param('id') bookingId: string) {
    return this.labOrdersService.getPendingUnbilledOrders(bookingId);
  }

  @Patch(':id/result')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Add or update the lab result for an order' })
  @ApiResponse({ status: 200, description: 'Lab result saved successfully' })
  addResult(
    @CurrentUser('id') userId: string,
    @Param('id') labOrderId: string,
    @Body() dto: UploadLabResultDto,
  ) {
    return this.labOrdersService.addResult(userId, labOrderId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a pending lab order' })
  deleteOrder(
    @CurrentUser('id') doctorId: string,
    @Param('id') labOrderId: string,
  ) {
    return this.labOrdersService.deleteOrder(doctorId, labOrderId);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Update the lab order status (e.g. IN_PROGRESS)' })
  @ApiResponse({ status: 200, description: 'Lab order status updated' })
  updateOrderStatus(
    @Param('id') labOrderId: string,
    @Body('status') status: LabOrderStatus,
  ) {
    return this.labOrdersService.updateOrderStatus(labOrderId, status);
  }
}
