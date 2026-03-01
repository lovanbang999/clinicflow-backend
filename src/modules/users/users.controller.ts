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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  @Get('public/doctors')
  @Public()
  @ApiOperation({
    summary: 'Get all doctors (Public - No auth required)',
    description: 'Retrieve list of active doctors for public viewing',
  })
  @ApiQuery({
    name: 'specialty',
    required: false,
    description: 'Filter by specialty',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiResponse({
    status: 200,
    description: 'Doctors retrieved successfully',
  })
  getPublicDoctors(
    @Query('specialty') specialty?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findPublicDoctors({
      specialty,
      page: page || 1,
      limit: limit || 100,
    });
  }

  @Get('public/doctors/:id')
  @Public()
  @ApiOperation({
    summary: 'Get doctor by ID (Public - No auth required)',
    description:
      'Retrieve detailed information of a specific doctor based on their ID without authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor not found',
  })
  getPublicDoctor(@Param('id') id: string) {
    return this.usersService.findPublicDoctor(id);
  }

  // ============================================
  // AUTHENTICATED ENDPOINTS
  // ============================================

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new user (ADMIN only)',
    description:
      'Admin can create users with any role. Created users are auto-verified.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already exists',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Get all users with filters (ADMIN/RECEPTIONIST only)',
    description:
      'Retrieve paginated list of users with optional filters for role, status, and search',
  })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  findAll(@Query() filterDto: FilterUserDto) {
    return this.usersService.findAll(filterDto);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get user statistics (ADMIN only)',
    description: 'Get aggregated statistics about users',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  getStatistics() {
    return this.usersService.getStatistics();
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  getCurrentUser(@CurrentUser('id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Users can update their own profile (excluding role)',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  updateCurrentUser(
    @CurrentUser('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Prevent users from changing their own role
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role, ...safeUpdate } = updateUserDto;
    return this.usersService.update(userId, safeUpdate);
  }

  @Patch('me/password')
  @ApiOperation({
    summary: 'Change password',
    description: 'User can change their own password',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Current password is incorrect',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Get user by ID (ADMIN/RECEPTIONIST only)',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update user by ID (ADMIN only)',
    description: 'Admin can update any user including role and status',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already exists',
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user (ADMIN only)',
    description: 'Soft delete user by setting isActive to false',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
