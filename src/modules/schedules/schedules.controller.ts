import {
  Controller,
  Get,
  Post,
  Delete,
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
import { SchedulesService } from './schedules.service';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { CreateBreakTimeDto } from './dto/create-break-time.dto';
import { CreateOffDayDto } from './dto/create-off-day.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, DayOfWeek } from '@prisma/client';

@ApiTags('schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post('working-hours')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Create or update working hours (ADMIN/DOCTOR only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Working hours saved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Working hours saved successfully',
        messageCode: 'SCHEDULE.CREATE.SUCCESS',
        data: {
          id: 'uuid',
          doctorId: 'uuid',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '17:00',
          createdAt: '2024-12-26T10:00:00Z',
          updatedAt: '2024-12-26T10:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid time format or start time after end time',
  })
  createWorkingHours(@Body() dto: CreateWorkingHoursDto) {
    return this.schedulesService.createWorkingHours(dto);
  }

  @Get('working-hours/:doctorId')
  @Public()
  @ApiOperation({ summary: 'Get working hours for a doctor (public)' })
  @ApiResponse({
    status: 200,
    description: 'Working hours retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Working hours retrieved successfully',
        messageCode: 'SCHEDULE.LIST.SUCCESS',
        data: [
          {
            id: 'uuid',
            doctorId: 'uuid',
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
      },
    },
  })
  getWorkingHours(@Param('doctorId') doctorId: string) {
    return this.schedulesService.getWorkingHours(doctorId);
  }

  @Delete('working-hours/:doctorId/:dayOfWeek')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete working hours (ADMIN/DOCTOR only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Working hours deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Working hours not found',
  })
  deleteWorkingHours(
    @Param('doctorId') doctorId: string,
    @Param('dayOfWeek') dayOfWeek: DayOfWeek,
  ) {
    return this.schedulesService.deleteWorkingHours(doctorId, dayOfWeek);
  }

  @Post('break-times')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Create break time (ADMIN/DOCTOR/RECEPTIONIST only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Break time created successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Break time created successfully',
        messageCode: 'SCHEDULE.CREATE.SUCCESS',
        data: {
          id: 'uuid',
          doctorId: 'uuid',
          date: '2024-12-26',
          startTime: '12:00',
          endTime: '13:00',
          reason: 'Lunch break',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or past date',
  })
  createBreakTime(@Body() dto: CreateBreakTimeDto) {
    return this.schedulesService.createBreakTime(dto);
  }

  @Get('break-times/:doctorId')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Get break times for a doctor (ADMIN/DOCTOR/RECEPTIONIST only)',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-12-26' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Break times retrieved successfully',
  })
  getBreakTimes(
    @Param('doctorId') doctorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.schedulesService.getBreakTimes(doctorId, startDate, endDate);
  }

  @Delete('break-times/:id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete break time (ADMIN/DOCTOR/RECEPTIONIST only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Break time deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Break time not found',
  })
  deleteBreakTime(@Param('id') id: string) {
    return this.schedulesService.deleteBreakTime(id);
  }

  @Post('off-days')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Create off day (ADMIN/DOCTOR only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Off day created successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Off day created successfully',
        messageCode: 'SCHEDULE.CREATE.SUCCESS',
        data: {
          id: 'uuid',
          doctorId: 'uuid',
          date: '2024-12-26',
          reason: 'Holiday',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or past date',
  })
  @ApiResponse({
    status: 409,
    description: 'Off day already exists',
  })
  createOffDay(@Body() dto: CreateOffDayDto) {
    return this.schedulesService.createOffDay(dto);
  }

  @Get('off-days/:doctorId')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Get off days for a doctor (ADMIN/DOCTOR/RECEPTIONIST only)',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-12-26' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Off days retrieved successfully',
  })
  getOffDays(
    @Param('doctorId') doctorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.schedulesService.getOffDays(doctorId, startDate, endDate);
  }

  @Delete('off-days/:doctorId/:date')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete off day (ADMIN/DOCTOR only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Off day deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Off day not found',
  })
  deleteOffDay(
    @Param('doctorId') doctorId: string,
    @Param('date') date: string,
  ) {
    return this.schedulesService.deleteOffDay(doctorId, date);
  }

  @Get('available-slots')
  @Public()
  @ApiOperation({
    summary:
      'Get available time slots for a doctor on a specific date (public)',
    description:
      'Returns available time slots considering working hours, break times, off days, and existing bookings. Optionally excludes slots already booked by a specific patient.',
  })
  @ApiQuery({ name: 'doctorId', required: true })
  @ApiQuery({ name: 'serviceId', required: true })
  @ApiQuery({ name: 'date', required: true, example: '2024-12-26' })
  @ApiQuery({
    name: 'patientId',
    required: false,
    description: 'Patient ID to exclude their already booked slots',
  })
  @ApiResponse({
    status: 200,
    description: 'Available slots retrieved successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Available slots retrieved successfully',
        messageCode: 'SCHEDULE.SLOTS.SUCCESS',
        data: {
          availableSlots: ['09:00', '09:30', '10:00', '10:30'],
          total: 4,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor or service not found',
  })
  getAvailableSlots(@Query() queryDto: AvailableSlotsQueryDto) {
    return this.schedulesService.getAvailableSlots(queryDto);
  }
}
