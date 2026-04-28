import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Get my in-app notifications' })
  @Get('me')
  async getMyNotifications(@Req() req: Request) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) throw new UnauthorizedException();
    return await this.notificationsService.getMyNotifications(user.id);
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Patch(':id/read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) throw new UnauthorizedException();
    await this.notificationsService.markAsRead(user.id, id);
    return { success: true };
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) throw new UnauthorizedException();
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }
}
