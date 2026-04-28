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
  ParseUUIDPipe,
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
import { CreateDirectServiceBookingDto } from './dto/create-direct-service-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { UpdateBookingServiceDto } from './dto/update-booking-service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from '@prisma/client';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Create a new online booking',
    description:
      'Create an online booking for a registered patient profile. Initial status will be PENDING.',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Booking created successfully',
        messageCode: 'BOOKING.CREATED.SUCCESS',
        data: {
          id: 'uuid',
          bookingCode: 'BK-20241230-0001',
          patientProfileId: 'uuid',
          doctorId: 'uuid',
          serviceId: 'uuid',
          bookingDate: '2024-12-30',
          startTime: '09:00',
          endTime: '09:30',
          status: 'PENDING',
          source: 'ONLINE',
          priority: 'NORMAL',
          patientNotes: '...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid booking data (date/slot/profile)',
  })
  @ApiResponse({ status: 404, description: 'Doctor or Service not found' })
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

  @Post('receptionist')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a booking as receptionist (pre-booking or walk-in)',
    description:
      'Creates a booking on behalf of a patient. Use `isPreBooked=true` with `startTime` to reserve a specific slot (pre-booking). Use `isPreBooked=false` without `startTime` for walk-in queue entry. Status is automatically CONFIRMED.',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created and confirmed successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Walk-in booking created successfully',
        data: {
          id: 'uuid',
          bookingCode: 'BK-20241230-0002',
          isPreBooked: false,
          startTime: null,
          endTime: null,
          estimatedTime: null,
          status: 'CONFIRMED',
          source: 'RECEPTIONIST',
          confirmedAt: '2024-03-20T10:00:00.000Z',
        },
      },
    },
  })
  createByReceptionist(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.createByReceptionist(createBookingDto, userId);
  }

  @Post('receptionist/direct-service')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Mode B — Đặt thẳng dịch vụ (không qua tư vấn)',
    description:
      'Bệnh nhân đã biết cần xét nghiệm / khám chuyên khoa gì. ' +
      'Tạo Booking + MedicalRecord (visitStep=SERVICES_ORDERED) + LabOrder/VisitServiceOrder + Invoice LAB DRAFT trong 1 transaction. ' +
      'KHÔNG tạo CONSULTATION invoice. KHÔNG qua B2 tư vấn.',
  })
  @ApiResponse({ status: 201, description: 'Direct service booking created' })
  @ApiResponse({ status: 404, description: 'Service or Doctor not found' })
  @ApiResponse({ status: 409, description: 'Queue full for this doctor today' })
  createDirectServiceBooking(
    @Body() dto: CreateDirectServiceBookingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.createDirectServiceBooking(dto, userId);
  }

  @Patch(':id/service')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'B2 — Bác sĩ tư vấn xác định dịch vụ chuyên khoa',
    description:
      'Mô hình A: BS tư vấn gọi bệnh nhân, hỏi thăm triệu chứng và xác định dịch vụ chuyên khoa cần khám. ' +
      'Lễ tân không có quyền chọn dịch vụ — chỉ bác sĩ mới có quyền này. ' +
      'Sau khi xác nhận, hệ thống tự tạo Invoice CONSULTATION (DRAFT).',
  })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  @ApiResponse({ status: 403, description: 'Not the assigned doctor' })
  @ApiResponse({ status: 404, description: 'Booking or Service not found' })
  @ApiResponse({ status: 409, description: 'Service already set' })
  updateService(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: UpdateBookingServiceDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.assignSpecialistService(
      bookingId,
      dto.serviceId,
      user.id,
      dto.newDoctorId,
    );
  }

  @Get('doctor/my-patients')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Get unique patients of this doctor',
    description:
      'Returns a paginated list of unique patients who have had at least one completed visit with the authenticated doctor.',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Patients retrieved successfully' })
  getMyPatients(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.findMyPatients(user.id, {
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      currentUser: user,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({
    summary: 'List all bookings',

    description:
      'Retrieve a paginated list of all bookings with advanced filtering options for admin/receptionist.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of bookings retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        data: {
          bookings: [
            {
              id: 'uuid',
              bookingCode: 'BK-20241230-0001',
              status: 'CONFIRMED',
              patientProfile: {
                fullName: 'Alex Jones',
                patientCode: 'P-12345',
              },
              doctor: { fullName: 'Dr. Smith' },
              service: { name: 'General Checkup' },
            },
          ],
          pagination: { total: 100, page: 1, limit: 10, totalPages: 10 },
        },
      },
    },
  })
  findAll(@Query() filterDto: FilterBookingDto) {
    return this.bookingsService.findAll(filterDto);
  }

  @Get('my-bookings')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Get current user bookings',
    description:
      'Retrieve paginated appointments for the authenticated patient.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by booking status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'My bookings retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        data: {
          bookings: [
            {
              id: 'uuid',
              bookingDate: '2024-12-30',
              status: 'CONFIRMED',
              service: { name: 'Consultation' },
              doctor: { fullName: 'Dr. House' },
            },
          ],
          pagination: { total: 5, page: 1, limit: 10, totalPages: 1 },
        },
      },
    },
  })
  getMyBookings(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: User,
  ) {
    return this.bookingsService.findMyBookings(user!.id, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.PATIENT,
  )
  @ApiOperation({
    summary: 'Get booking details by ID',
    description:
      'Retrieve a single booking record including full relations like patient, doctor, service, queue position, and status history.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking details retrieved',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        data: {
          id: 'uuid',
          bookingCode: 'BK-20241230-0001',
          status: 'CONFIRMED',
          statusHistory: [
            {
              oldStatus: 'PENDING',
              newStatus: 'CONFIRMED',
              changedBy: { fullName: 'Admin' },
            },
          ],
          patientProfile: { fullName: 'Alex', patientCode: 'P-12345' },
          service: { name: 'Service Name', durationMinutes: 30 },
          queueRecord: { queuePosition: 5, estimatedWaitMinutes: 15 },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.findOne(id, user);
  }

  @Post(':id/check-in')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check-in patient to consultation queue',
    description:
      'Marks the booking as CHECKED_IN and adds the patient to the priority queue based on their appointment time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Patient checked in and added to queue',
    schema: {
      example: {
        success: true,
        message: 'QUEUE.PROMOTE.SUCCESS',
        data: {
          booking: {
            id: 'uuid',
            bookingCode: 'BK-20240101-0001',
            status: 'CHECKED_IN',
          },
          queue: {
            queuePosition: 5,
            estimatedWaitMinutes: 60,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Only confirmed bookings can be checked in, or already in queue',
  })
  checkIn(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.checkIn(id, user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update appointment status',
    description:
      'Manually update the status of an appointment. Includes validation to prevent impossible status transitions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking status updated successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Booking status updated successfully',
        data: {
          id: 'uuid',
          status: 'CHECKED_IN',
          checkedInAt: '2024-03-20T11:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition (e.g. Completed -> Cancelled)',
  })
  updateStatus(
    @Param('id') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.updateStatus(bookingId, dto, user.id, user);
  }

  @Patch(':id/start')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Start examination' })
  startExamination(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.startExamination(id, user.id, user);
  }

  @Patch(':id/complete')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Complete visit' })
  completeVisit(
    @Param('id') id: string,
    @Body('doctorNotes') doctorNotes: string,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.completeVisit(id, user.id, doctorNotes, user);
  }

  @Patch(':id/no-show')
  @Roles(UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark as no-show' })
  markNoShow(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.markNoShow(id, user.id, user);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.PATIENT,
  )
  @ApiOperation({
    summary: 'Cancel an appointment',
    description:
      'Cancel a booking record by ID with a mandatory reason. Can be performed by the patient or staff.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Booking cancelled successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cancellation reason is required and must be detailed',
  })
  cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.cancelBooking(id, user.id, dto.reason, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Soft-delete a booking',
    description:
      'Effectively cancels the booking record. Restricted to Administrators only.',
  })
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
    summary: 'Get patient dashboard stats',
    description:
      'Retrieve summary counts (upcoming, completed, waiting) and the next closest appointment for the patient dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
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
            status: 'CONFIRMED',
            service: { name: 'General Checkup' },
            doctor: { fullName: 'Dr. An' },
          },
        },
      },
    },
  })
  getPatientDashboardStats(@CurrentUser('id') patientId: string) {
    return this.bookingsService.getPatientDashboardStats(patientId);
  }

  @Get('dashboard/receptionist-stats')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get receptionist dashboard stats',
    description:
      'Retrieve booking statistics (pending, confirmed, completed, cancelled) for today and trends compared to yesterday.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        data: {
          pending: { value: 10, trend: 15, trendDir: 'up' },
          confirmed: { value: 25, trend: 5, trendDir: 'up' },
          completed: { value: 15, trend: 10, trendDir: 'down' },
          cancelled: { value: 2, trend: 0, trendDir: 'neutral' },
        },
      },
    },
  })
  getReceptionistDashboardStats() {
    return this.bookingsService.getReceptionistDashboardStats();
  }
}
