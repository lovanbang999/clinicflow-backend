import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { PromoteQueueDto } from './dto/promote-queue.dto';
import { QueueFilterDto } from './dto/queue-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('queue')
@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all queued bookings' })
  @ApiQuery({ name: 'doctorId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'timeSlot', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of queued bookings',
  })
  findAll(@Query() filterDto: QueueFilterDto) {
    return this.queueService.findAll(filterDto);
  }

  @Get('statistics')
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiQuery({ name: 'doctorId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics',
    schema: {
      example: {
        totalQueued: 5,
        averageWaitTimeMinutes: 45,
        longestQueuePosition: 3,
      },
    },
  })
  getStatistics(
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
  ) {
    return this.queueService.getStatistics(doctorId, date);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get queue info by booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Queue record details',
  })
  @ApiResponse({
    status: 404,
    description: 'Queue record not found',
  })
  findByBookingId(@Param('bookingId') bookingId: string) {
    return this.queueService.findByBookingId(bookingId);
  }

  @Post('promote')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually promote a booking from queue (RECEPTIONIST/ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking promoted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot promote - slot still full or booking not in queue',
  })
  @ApiResponse({
    status: 404,
    description: 'Queue record not found',
  })
  promoteManually(
    @Body() promoteDto: PromoteQueueDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.queueService.promoteManually(promoteDto, userId);
  }
}
