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
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';

@ApiTags('admin - settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  @ResponseMessage(
    MessageCodes.SETTINGS_RETRIEVED,
    'All system settings retrieved successfully',
  )
  @ApiOperation({ summary: 'Get all system settings (ADMIN only)' })
  getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Patch('clinic-profile')
  @ResponseMessage(
    MessageCodes.SETTINGS_UPDATED,
    'Clinic profile settings updated successfully',
  )
  @ApiOperation({ summary: 'Update clinic profile settings (ADMIN only)' })
  updateClinicProfile(
    @Body() dto: UpdateClinicProfileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSettings(
      'CLINIC',
      dto as unknown as Record<string, unknown>,
      userId,
    );
  }

  @Patch('booking-rules')
  @ResponseMessage(
    MessageCodes.SETTINGS_UPDATED,
    'Booking/scheduling rules updated successfully',
  )
  @ApiOperation({ summary: 'Update booking/scheduling rules (ADMIN only)' })
  updateBookingRules(
    @Body() dto: UpdateBookingRulesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSettings(
      'BOOKING',
      dto as unknown as Record<string, unknown>,
      userId,
    );
  }

  @Patch('notifications')
  @ResponseMessage(
    MessageCodes.SETTINGS_UPDATED,
    'Notification settings updated successfully',
  )
  @ApiOperation({
    summary: 'Update notification/communication settings (ADMIN only)',
  })
  updateNotifications(
    @Body() dto: UpdateNotificationConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSettings(
      'NOTIFICATION',
      dto as unknown as Record<string, unknown>,
      userId,
    );
  }
}
