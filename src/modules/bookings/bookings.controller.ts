import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid booking data',
  })
  @ApiResponse({
    status: 409,
    description: 'Booking conflict (duplicate or slot full)',
  })
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.create(createBookingDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings with filters' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'doctorId', required: false })
  @ApiQuery({ name: 'serviceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of bookings',
  })
  findAll(@Query() filterDto: FilterBookingDto) {
    return this.bookingsService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking details',
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
  })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update booking status (DOCTOR/RECEPTIONIST/ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateBookingStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.updateStatus(id, updateStatusDto, userId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully',
  })
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.cancel(id, userId, reason);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete booking (ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Booking deleted successfully',
  })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.remove(id, userId);
  }

  @Get('dashboard/stats')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Get patient dashboard statistics',
    description: 'Get booking statistics for current patient',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Dashboard statistics retrieved successfully',
        messageCode: 'BOOKING.LIST.SUCCESS',
        data: {
          stats: {
            upcomingBookings: 2,
            completedBookings: 12,
            waitingBookings: 1,
            totalBookings: 15,
          },
          nextBooking: {
            id: 'uuid',
            bookingDate: '2024-12-30',
            startTime: '09:00',
            endTime: '09:30',
            status: 'CONFIRMED',
            service: {
              id: 'uuid',
              name: 'Khám tổng quát',
            },
            doctor: {
              id: 'uuid',
              fullName: 'BS. Nguyễn Văn An',
              avatar: null,
            },
          },
        },
      },
    },
  })
  getPatientDashboardStats(@CurrentUser('id') patientId: string) {
    return this.bookingsService.getPatientDashboardStats(patientId);
  }
}
