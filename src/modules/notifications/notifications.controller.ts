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

interface InAppNotification {
  id: string;
  type:
    | 'BOOKING_CONFIRMED'
    | 'BOOKING_REMINDER'
    | 'BOOKING_CANCELLED'
    | 'LAB_RESULT'
    | 'GENERAL';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  userId?: string;
}

// In-memory store per userId
const notificationStore: Map<string, InAppNotification[]> = new Map();

export function addNotificationForUser(
  userId: string,
  notification: Omit<InAppNotification, 'id' | 'isRead' | 'createdAt'>,
) {
  const list = notificationStore.get(userId) ?? [];
  list.unshift({
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  // Keep only latest 50
  notificationStore.set(userId, list.slice(0, 50));
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  @ApiOperation({ summary: 'Get my in-app notifications' })
  @Get('me')
  getMyNotifications(@Req() req: Request) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) throw new UnauthorizedException();
    const list = notificationStore.get(user.id) ?? [];
    const unreadCount = list.filter((n) => !n.isRead).length;
    return { notifications: list, unreadCount };
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Patch(':id/read')
  markAsRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) throw new UnauthorizedException();
    const list = notificationStore.get(user.id) ?? [];
    const updated = list.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    notificationStore.set(user.id, updated);
    return { success: true };
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  markAllAsRead(@Req() req: Request) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) throw new UnauthorizedException();
    const list = (notificationStore.get(user.id) ?? []).map((n) => ({
      ...n,
      isRead: true,
    }));
    notificationStore.set(user.id, list);
    return { success: true };
  }
}
