import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Dashboard Query DTOs
import { GetMonthlyStatsQueryDto } from './dto/get-monthly-stats.query.dto';
import { GetTopDoctorsQueryDto } from './dto/get-top-doctors.query.dto';
import { GetRevenueChartQueryDto } from './dto/get-revenue-chart.query.dto';

// Dashboard Response DTOs (for Swagger @ApiResponse typing)
import { DashboardOverviewResponseDto } from './dto/dashboard-overview.response.dto';
import { MonthlyStatsResponseDto } from './dto/monthly-stats.response.dto';
import { TopDoctorsResponseDto } from './dto/top-doctors.response.dto';
import { RevenueChartResponseDto } from './dto/revenue-chart.response.dto';
import { BookingOverviewResponseDto } from './dto/booking-overview.response.dto';

// User Management DTOs
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminSuspendUserDto } from './dto/admin-suspend-user.dto';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  // ============================================================
  // DASHBOARD
  // ============================================================

  @Get('dashboard/overview')
  @ApiOperation({
    summary: 'KPI overview (ADMIN only)',
    description:
      'Returns the 4 key metrics: totalUsers (patients), totalDoctors, ' +
      'totalBookings, totalRevenue. Also includes month-on-month trend values ' +
      'used by the KPI badges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview retrieved successfully',
    type: DashboardOverviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('dashboard/monthly-stats')
  @ApiOperation({
    summary: 'Monthly statistics (ADMIN only)',
    description:
      'Returns stats for a given month: bookingCount, newPatients, ' +
      'successRate, revenue. Defaults to current month if no query param provided.',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly stats retrieved successfully',
    type: MonthlyStatsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid month format' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getMonthlyStats(@Query() query: GetMonthlyStatsQueryDto) {
    return this.adminService.getMonthlyStats(query.month);
  }

  @Get('dashboard/top-doctors')
  @ApiOperation({
    summary: 'Top doctors by completed visits (ADMIN only)',
    description:
      'Returns doctors ranked by completed booking count. Configurable via limit (max 20).',
  })
  @ApiResponse({
    status: 200,
    description: 'Top doctors retrieved successfully',
    type: TopDoctorsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getTopDoctors(@Query() query: GetTopDoctorsQueryDto) {
    return this.adminService.getTopDoctors(query.limit ?? 5);
  }

  @Get('dashboard/revenue-chart')
  @ApiOperation({
    summary: 'Monthly revenue chart data (ADMIN only)',
    description:
      'Returns revenue aggregated by month for the last N months. ' +
      'Each point: { date: "YYYY-MM-01", revenue: number }. Max 24 months.',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue chart data retrieved successfully',
    type: RevenueChartResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getRevenueChart(@Query() query: GetRevenueChartQueryDto) {
    return this.adminService.getRevenueChart(query.months ?? 6);
  }

  @Get('dashboard/booking-overview')
  @ApiOperation({
    summary: 'Booking status overview (ADMIN only)',
    description:
      'Returns booking counts broken down by status (completed, upcoming, ' +
      'cancelled, inProgress) with percentage values ready for the stacked bar chart.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking overview retrieved successfully',
    type: BookingOverviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getBookingOverview() {
    return this.adminService.getBookingOverview();
  }

  // ============================================================
  // USER MANAGEMENT — /admin/users
  // ============================================================

  /**
   * GET /admin/users
   * List all users with filtering + pagination
   */
  @Get('users')
  @ApiOperation({
    summary: 'List all users (ADMIN only)',
    description:
      'Returns a paginated, filterable list of all system users. ' +
      'Supports filtering by role, active status, and full-text search on name/email.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filter by role',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by account status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getUsers(@Query() filterDto: FilterUserDto) {
    return this.usersService.findAll(filterDto);
  }

  /**
   * GET /admin/users/statistics
   * Aggregate statistics for User Management stat cards
   */
  @Get('users/statistics')
  @ApiOperation({
    summary: 'User statistics (ADMIN only)',
    description:
      'Returns aggregate statistics: totalUsers, activeUsers, inactiveUsers, ' +
      'usersByRole breakdown, and doctorProfileCount. Used to populate the 4 stat cards.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getUserStatistics() {
    return this.usersService.getStatistics();
  }

  /**
   * GET /admin/users/:id
   * Get single user detail
   */
  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getUserById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * POST /admin/users
   * Create a new user account
   */
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user (ADMIN only)',
    description:
      'Admin creates a user with any role. The account is auto-verified. ' +
      'Use isActive=false to create the account in a disabled state.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.usersService.create(dto);
  }

  /**
   * PATCH /admin/users/:id
   * Update user information (name, email, role, etc.)
   */
  @Patch('users/:id')
  @ApiOperation({
    summary: 'Update user (ADMIN only)',
    description:
      'Admin can update any user field including role and active status.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  /**
   * PATCH /admin/users/:id/suspend
   * Suspend or reinstate a user account
   */
  @Patch('users/:id/suspend')
  @ApiOperation({
    summary: 'Suspend or reinstate a user (ADMIN only)',
    description:
      'Toggles the isActive flag. Pass { isActive: false } to suspend, ' +
      '{ isActive: true } to reinstate. This is a soft operation — no data is deleted.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  suspendUser(@Param('id') id: string, @Body() dto: AdminSuspendUserDto) {
    return this.usersService.update(id, { isActive: dto.isActive });
  }

  /**
   * DELETE /admin/users/:id
   * Soft-delete a user (sets isActive = false permanently)
   */
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a user (ADMIN only)',
    description:
      'Soft-deletes the user by setting isActive to false. ' +
      'The record is retained in the database for audit purposes.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
