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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

import { AdminSchedulesService } from './admin-schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';

@ApiTags('admin - schedules')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/schedules')
export class AdminSchedulesController {
  constructor(private readonly schedulesService: AdminSchedulesService) {}

  /**
   * GET /admin/schedules/statistics
   * Returns schedule statistics for the admin dashboard.
   */
  @Get('statistics')
  @ResponseMessage(
    MessageCodes.SCHEDULE_STATISTICS_RETRIEVED,
    'Schedule statistics retrieved successfully',
  )
  @ApiOperation({
    summary: 'Schedule statistics (ADMIN only)',
    description:
      'Returns total appointments, todays slots, canceled bookings today, and avg wait time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getStatistics() {
    return this.schedulesService.getStatistics();
  }

  /**
   * GET /admin/schedules/rooms
   * List all active rooms for scheduling slots
   */
  @Get('rooms')
  @ResponseMessage(MessageCodes.ROOMS_RETRIEVED, 'Rooms retrieved successfully')
  @ApiOperation({
    summary: 'List all active rooms (ADMIN only)',
    description: 'Returns a list of active rooms to assign schedules.',
  })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  getRooms() {
    return this.schedulesService.getRooms();
  }

  /**
   * POST /admin/schedules
   * Create a new schedule slot for a doctor.
   */
  @Post()
  @ResponseMessage(
    MessageCodes.SCHEDULE_CREATED,
    'Schedule slot created successfully',
  )
  @ApiOperation({
    summary: 'Create a new schedule slot (ADMIN only)',
    description:
      'Creates a new availability slot for a doctor. Requires doctorId, date, startTime, endTime, and maxPatients.',
  })
  @ApiResponse({
    status: 201,
    description: 'Schedule slot created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request Validation Error' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.schedulesService.create(createScheduleDto);
  }

  /**
   * GET /admin/schedules
   * Paginated & filterable list of all schedule slots.
   */
  @Get()
  @ResponseMessage(
    MessageCodes.SCHEDULE_LIST_RETRIEVED,
    'Schedules retrieved successfully',
  )
  @ApiOperation({
    summary: 'List all schedule slots (ADMIN only)',
    description:
      'Returns a list of schedule slots. Supports filtering by doctorId, startDate, endDate, and isActive.',
  })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  findAll(@Query() filterScheduleDto: FilterScheduleDto) {
    return this.schedulesService.findAll(filterScheduleDto);
  }

  /**
   * GET /admin/schedules/:id
   * Get detail of a single schedule slot.
   */
  @Get(':id')
  @ResponseMessage(
    MessageCodes.SCHEDULE_RETRIEVED,
    'Schedule slot retrieved successfully',
  )
  @ApiOperation({ summary: 'Get schedule slot by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Schedule slot UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule slot retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Schedule slot not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  /**
   * PATCH /admin/schedules/:id
   * Update fields of a specific schedule slot.
   */
  @Patch(':id')
  @ResponseMessage(
    MessageCodes.SCHEDULE_UPDATED,
    'Schedule slot updated successfully',
  )
  @ApiOperation({
    summary: 'Update schedule slot (ADMIN only)',
    description:
      'Update the fields of a specific schedule slot (e.g. times, maxPatients, room).',
  })
  @ApiParam({ name: 'id', description: 'Schedule slot UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule slot updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request Validation Error' })
  @ApiResponse({ status: 404, description: 'Schedule slot not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  update(
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  /**
   * DELETE /admin/schedules/:id
   * Soft delete (suspend) a schedule slot.
   */
  @Delete(':id')
  @ResponseMessage(
    MessageCodes.SCHEDULE_DELETED,
    'Schedule slot deleted successfully',
  )
  @ApiOperation({
    summary: 'Soft delete a schedule slot (ADMIN only)',
    description:
      'Marks a schedule slot as inactive (isActive: false) effectively soft deleting it.',
  })
  @ApiParam({ name: 'id', description: 'Schedule slot UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule slot deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Schedule slot not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  remove(@Param('id') id: string) {
    return this.schedulesService.remove(id);
  }

  /**
   * PATCH /admin/schedules/:id/restore
   * Restore a previously soft-deleted schedule slot.
   */
  @Patch(':id/restore')
  @ResponseMessage(
    MessageCodes.SCHEDULE_RESTORED,
    'Schedule slot restored successfully',
  )
  @ApiOperation({
    summary: 'Restore a deleted schedule slot (ADMIN only)',
    description:
      'Sets the isActive flag to true for a soft deleted schedule slot.',
  })
  @ApiParam({ name: 'id', description: 'Schedule slot UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule slot restored successfully',
  })
  @ApiResponse({ status: 404, description: 'Schedule slot not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  restore(@Param('id') id: string) {
    return this.schedulesService.restore(id);
  }
}
