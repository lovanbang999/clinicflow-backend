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
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AdminRoomsService } from './admin-rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FilterRoomDto } from './dto/filter-room.dto';

@ApiTags('admin - rooms')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/rooms')
export class AdminRoomsController {
  constructor(private readonly roomsService: AdminRoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  findAll(@Query() filter: FilterRoomDto) {
    return this.roomsService.findAll(filter);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new room (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 409, description: 'Room name already exists' })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update room (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a room (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room deactivated successfully' })
  @ApiResponse({ status: 400, description: 'Room has active schedule slots' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a deactivated room (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room restored successfully' })
  restore(@Param('id') id: string) {
    return this.roomsService.restore(id);
  }
}
