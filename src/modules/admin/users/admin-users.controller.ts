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
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { FilterUserDto } from '../../users/dto/filter-user.dto';
import { AdminSuspendUserDto } from './dto/admin-suspend-user.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateUserDto } from 'src/modules/users/dto/update-user.dto';

@ApiTags('admin - users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

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
   * Soft-delete a user (stamps deletedAt, sets isActive = false)
   */
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a user (ADMIN only)',
    description:
      'Soft-deletes the user by stamping deletedAt with the current timestamp and setting isActive to false. ' +
      'The record is fully retained in the database for audit purposes and will no longer appear in any user listing. ' +
      'This action cannot be undone from the API — contact a database admin to restore.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User soft-deleted successfully' })
  @ApiResponse({
    status: 404,
    description: 'User not found or already deleted',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
