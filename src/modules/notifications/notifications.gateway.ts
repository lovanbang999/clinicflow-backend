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
   * Client joins their own private room after authentication
   */
  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string,
  ) {
    if (!userId) return;
    const roomName = `user_${userId}`;
    void client.join(roomName);
    this.logger.debug(
      `User ${userId} authenticated and joined room ${roomName}`,
    );
    return { event: 'authenticated', data: { userId, room: roomName } };
  }

  /**
   * Send a real-time notification to a specific user
   */
  sendToUser(userId: string, notification: any) {
    const roomName = `user_${userId}`;
    this.server.to(roomName).emit('newNotification', notification);
    this.logger.debug(`Sent real-time notification to user ${userId}`);
  }
}
