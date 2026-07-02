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

import { AdminMedicinesService } from './admin-medicines.service';
import { AdminCreateMedicineDto } from './dto/admin-create-medicine.dto';
import { AdminUpdateMedicineDto } from './dto/admin-update-medicine.dto';
import { FilterMedicineDto } from './dto/filter-medicine.dto';
import { MedicineStatsResponseDto } from './dto/medicine-stats.response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';

@ApiTags('admin - medicines')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminMedicinesController {
  constructor(private readonly medicinesService: AdminMedicinesService) {}

  /**
   * GET /admin/medicines/statistics
   */
  @Get('medicines/statistics')
  @ResponseMessage(
    MessageCodes.MEDICINE_STATISTICS_RETRIEVED,
    'Medicine statistics retrieved successfully',
  )
  @ApiOperation({
    summary: 'Medicine statistics (ADMIN only)',
    description:
      'Returns totalMedicines, activeMedicines, inactiveMedicines, and outOfStockMedicines.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: MedicineStatsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getMedicineStatistics() {
    return this.medicinesService.getMedicineStatistics();
  }

  /**
   * GET /admin/medicines
   */
  @Get('medicines')
  @ResponseMessage(
    MessageCodes.MEDICINE_LIST_RETRIEVED,
    'Medicines retrieved successfully',
  )
  @ApiOperation({
    summary: 'List all medicines (ADMIN only)',
    description:
      'Returns all medicines with pagination, filtering, and searching.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Medicines list retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getMedicines(@Query() filterDto: FilterMedicineDto) {
    return this.medicinesService.findAllMedicines(filterDto);
  }

  /**
   * GET /admin/medicines/:id
   */
  @Get('medicines/:id')
  @ResponseMessage(
    MessageCodes.MEDICINE_RETRIEVED,
    'Medicine retrieved successfully',
  )
  @ApiOperation({ summary: 'Get medicine by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Medicine UUID' })
  @ApiResponse({
    status: 200,
    description: 'Medicine details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  getMedicineById(@Param('id') id: string) {
    return this.medicinesService.findOneMedicine(id);
  }

  /**
   * POST /admin/medicines
   */
  @Post('medicines')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage(
    MessageCodes.MEDICINE_CREATED,
    'Medicine created successfully',
  )
  @ApiOperation({ summary: 'Create a new medicine (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Medicine created successfully' })
  @ApiResponse({ status: 409, description: 'Medicine code already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  createMedicine(@Body() dto: AdminCreateMedicineDto) {
    return this.medicinesService.createMedicine(dto);
  }

  /**
   * PATCH /admin/medicines/:id
   */
  @Patch('medicines/:id')
  @ResponseMessage(
    MessageCodes.MEDICINE_UPDATED,
    'Medicine updated successfully',
  )
  @ApiOperation({ summary: 'Update medicine (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Medicine UUID' })
  @ApiResponse({ status: 200, description: 'Medicine updated successfully' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  @ApiResponse({ status: 409, description: 'Medicine code already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  updateMedicine(@Param('id') id: string, @Body() dto: AdminUpdateMedicineDto) {
    return this.medicinesService.updateMedicine(id, dto);
  }

  /**
   * DELETE /admin/medicines/:id
   */
  @Delete('medicines/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    MessageCodes.MEDICINE_DELETED,
    'Medicine deactivated successfully',
  )
  @ApiOperation({ summary: 'Deactivate a medicine (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Medicine UUID' })
  @ApiResponse({
    status: 200,
    description: 'Medicine deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  deleteMedicine(@Param('id') id: string) {
    return this.medicinesService.removeMedicine(id);
  }

  /**
   * PATCH /admin/medicines/:id/restore
   */
  @Patch('medicines/:id/restore')
  @ResponseMessage(
    MessageCodes.MEDICINE_RESTORED,
    'Medicine restored successfully',
  )
  @ApiOperation({ summary: 'Restore a deactivated medicine (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Medicine UUID' })
  @ApiResponse({ status: 200, description: 'Medicine restored successfully' })
  @ApiResponse({ status: 400, description: 'Medicine is already active' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  restoreMedicine(@Param('id') id: string) {
    return this.medicinesService.restoreMedicine(id);
  }
}
