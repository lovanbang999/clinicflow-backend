import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('NotificationsGateway');

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected to notifications: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected from notifications: ${client.id}`);
  }

  /**
   * Client joins their own private room and role-based room after authentication
   */
  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; role?: UserRole },
  ) {
    const userId = typeof data === 'string' ? data : data.userId;
    const role = typeof data === 'object' ? data.role : undefined;

    if (!userId) return;

    // Join private user room
    const userRoom = `user_${userId}`;
    void client.join(userRoom);

    // Join role-based room if provided
    if (role) {
      const roleRoom = `role_${role}`;
      void client.join(roleRoom);
      this.logger.debug(`User ${userId} joined role room ${roleRoom}`);
    }

    this.logger.debug(
      `User ${userId} authenticated and joined room ${userRoom}`,
    );
    return { event: 'authenticated', data: { userId, role } };
  }

  /**
   * Send a real-time notification to a specific user
   */
  sendToUser(userId: string, notification: any) {
    const roomName = `user_${userId}`;
    this.server.to(roomName).emit('newNotification', notification);
    this.logger.debug(`Sent real-time notification to user ${userId}`);
  }

  /**
   * Broadcast a notification to all users of a specific role
   */
  broadcastToRole(role: UserRole, notification: any) {
    const roomName = `role_${role}`;
    this.server.to(roomName).emit('newNotification', notification);
    this.logger.debug(`Broadcasted real-time notification to role ${role}`);
  }
}
