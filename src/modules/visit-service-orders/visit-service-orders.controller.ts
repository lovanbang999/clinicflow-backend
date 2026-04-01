import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LabOrderStatus, UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompleteServiceOrderDto } from './dto/complete-service-order.dto';
import { VisitServiceOrdersService } from './visit-service-orders.service';

@ApiTags('Visit Service Orders (KTV)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('visit-service-orders')
export class VisitServiceOrdersController {
  constructor(private readonly service: VisitServiceOrdersService) {}

  @Get('worklist')
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'B3: KTV worklist — pending/in-progress service orders',
  })
  @ApiQuery({ name: 'status', required: false, enum: LabOrderStatus })
  getWorklist(
    @Req() req: { user: { id: string } },
    @Query('status') status?: LabOrderStatus,
  ) {
    return this.service.getWorklist(req.user.id, status);
  }

  @Get(':id')
  @Roles(UserRole.TECHNICIAN, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get service order detail' })
  getDetail(@Param('id') id: string) {
    return this.service.getOrderDetail(id);
  }

  @Patch(':id/start')
  @Roles(UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'B3: KTV starts performing a service order' })
  startOrder(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.service.startOrder(id, req.user.id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.TECHNICIAN)
  @ApiOperation({
    summary: 'B3: KTV completes service order and records result',
  })
  completeOrder(
    @Param('id') id: string,
    @Body() dto: CompleteServiceOrderDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.completeOrder(id, dto, req.user.id);
  }
}
