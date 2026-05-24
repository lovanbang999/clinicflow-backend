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
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  patientProfile?: { id: string; patientCode: string } | null;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/queue',
})
@Injectable()
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('QueueGateway');

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown> | undefined;
      const authHeader = client.handshake.headers?.authorization;
      const token =
        typeof auth?.token === 'string'
          ? auth.token
          : typeof authHeader === 'string'
            ? authHeader.split(' ')[1]
            : undefined;

      if (!token) {
        throw new Error('No token provided');
      }

      const payload = await this.authService.verifyAccessToken(token);
      const user = await this.authService.validateUser(payload.sub);

      const authSocket = client as AuthenticatedSocket;
      authSocket.data.user = user;
      this.logger.debug(
        `Client connected: ${client.id}, User: ${user.email}, Role: ${user.role}`,
      );
    } catch (e) {
      this.logger.debug(`Client connection rejected: ${(e as Error).message}`);
      client.disconnect(true);
    }
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

    const authSocket = client as AuthenticatedSocket;
    const user = authSocket.data.user;
    if (!user) {
      return { event: 'error', data: 'Unauthorized' };
    }

    // Role Validation
    if (user.role === 'DOCTOR' && user.id !== doctorId) {
      return {
        event: 'error',
        data: 'Forbidden: You can only join your own queue',
      };
    }

    if (user.role === 'PATIENT') {
      return {
        event: 'error',
        data: 'Forbidden: Patients cannot join doctor queue room',
      };
    }

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
