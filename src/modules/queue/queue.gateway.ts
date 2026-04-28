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
  namespace: '/queue',
})
@Injectable()
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('QueueGateway');

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Client explicitly joining a doctor's socket room to receive live queue updates.
   */
  @SubscribeMessage('joinDoctorRoom')
  handleJoinDoctorRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() doctorId: string,
  ) {
    if (!doctorId) return;
    const roomName = `doctor_${doctorId}`;
    void client.join(roomName);
    this.logger.debug(`Client ${client.id} joined room ${roomName}`);
    return { event: 'roomJoined', data: roomName };
  }

  /**
   * Client leaving a doctor's socket room.
   */
  @SubscribeMessage('leaveDoctorRoom')
  handleLeaveDoctorRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() doctorId: string,
  ) {
    if (!doctorId) return;
    const roomName = `doctor_${doctorId}`;
    void client.leave(roomName);
    this.logger.debug(`Client ${client.id} left room ${roomName}`);
    return { event: 'roomLeft', data: roomName };
  }

  /**
   * Server-side trigger to broadcast to interconnected clients sitting on `doctor_${doctorId}` room
   */
  broadcastQueueUpdate(
    doctorId: string,
    type: 'CHECK_IN' | 'PROMOTED' | 'NO_SHOW' | 'UPDATE',
    data: unknown,
  ) {
    const roomName = `doctor_${doctorId}`;
    this.server.to(roomName).emit('queueUpdated', { type, doctorId, data });
  }
}
