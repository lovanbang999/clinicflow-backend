import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateClinicProfileDto } from './dto/clinic-profile.dto';
import { UpdateBookingRulesDto } from './dto/booking-rules.dto';
import { UpdateNotificationConfigDto } from './dto/notification-config.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('admin - settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings (ADMIN only)' })
  getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Patch('clinic-profile')
  @ApiOperation({ summary: 'Update clinic profile settings (ADMIN only)' })
  updateClinicProfile(
    @Body() dto: UpdateClinicProfileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSettings('CLINIC', dto, userId);
  }

  @Patch('booking-rules')
  @ApiOperation({ summary: 'Update booking/scheduling rules (ADMIN only)' })
  updateBookingRules(
    @Body() dto: UpdateBookingRulesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSettings('BOOKING', dto, userId);
  }

  @Patch('notifications')
  @ApiOperation({
    summary: 'Update notification/communication settings (ADMIN only)',
  })
  updateNotifications(
    @Body() dto: UpdateNotificationConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSettings('NOTIFICATION', dto, userId);
  }
}
