import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync } from 'fs';
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
    origin: '*',
  },
  namespace: '/queue',
})
@Injectable()
export class QueueGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('QueueGateway');

  constructor(private readonly authService: AuthService) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      void (async () => {
        try {
          const auth = socket.handshake.auth as
            | Record<string, unknown>
            | undefined;
          const authHeader = socket.handshake.headers?.authorization;
          const token =
            typeof auth?.token === 'string'
              ? auth.token
              : typeof authHeader === 'string'
                ? authHeader.split(' ')[1]
                : undefined;

          if (!token) {
            return next(new Error('Unauthorized: No token provided'));
          }

          const payload = await this.authService.verifyAccessToken(token);
          const user = await this.authService.validateUser(payload.sub);

          const authSocket = socket as AuthenticatedSocket;
          authSocket.data = authSocket.data || {};
          authSocket.data.user = user;
          next();
        } catch (e) {
          try {
            const errorMsg = `[QueueGateway Handshake Error] ${new Date().toISOString()} - client: ${socket.id} - auth: ${JSON.stringify(
              socket.handshake.auth,
            )} - error: ${(e as Error).message}\nStack: ${(e as Error).stack}\n`;
            appendFileSync(
              '/home/pang/work-space/SmartClinic/Code/socket_errors.log',
              errorMsg,
            );
          } catch {
            // ignore
          }
          next(new Error('Unauthorized'));
        }
      })();
    });
    this.logger.log(
      'QueueGateway initialized with Socket.IO authentication middleware.',
    );
  }

  handleConnection(client: Socket) {
    const authSocket = client as AuthenticatedSocket;
    const user = authSocket.data?.user;
    if (user) {
      this.logger.debug(
        `Client connected: ${client.id}, User: ${user.email}, Role: ${user.role}`,
      );
    } else {
      this.logger.warn(`Client connected without user data: ${client.id}`);
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
    @MessageBody() body: unknown,
  ) {
    const bodyObj = body as Record<string, unknown> | null | undefined;
    const doctorId =
      typeof body === 'string'
        ? body
        : typeof bodyObj?.doctorId === 'string'
          ? bodyObj.doctorId
          : typeof bodyObj?.id === 'string'
            ? bodyObj.id
            : undefined;
    this.logger.log(
      `Received joinDoctorRoom request from client ${client.id} with body: ${JSON.stringify(body)} (parsed doctorId: ${doctorId})`,
    );

    if (!doctorId) {
      this.logger.warn(`joinDoctorRoom failed: doctorId is empty`);
      return { event: 'error', data: 'Missing doctor ID' };
    }

    const authSocket = client as AuthenticatedSocket;
    const user = authSocket.data.user;
    if (!user) {
      this.logger.warn(
        `joinDoctorRoom failed: client ${client.id} has no authenticated user`,
      );
      return { event: 'error', data: 'Unauthorized' };
    }

    // Role Validation
    if (user.role === 'DOCTOR' && user.id !== doctorId) {
      this.logger.warn(
        `joinDoctorRoom failed: DOCTOR ${user.id} tried to join room for doctor ${doctorId}`,
      );
      return {
        event: 'error',
        data: 'Forbidden: You can only join your own queue',
      };
    }

    if (user.role === 'PATIENT') {
      this.logger.warn(
        `joinDoctorRoom failed: PATIENT ${user.id} tried to join room for doctor ${doctorId}`,
      );
      return {
        event: 'error',
        data: 'Forbidden: Patients cannot join doctor queue room',
      };
    }

    const roomName = `doctor_${doctorId}`;
    void client.join(roomName);
    this.logger.log(
      `Client ${client.id} (User: ${user.email}, Role: ${user.role}) successfully joined room: ${roomName}`,
    );
    return { event: 'roomJoined', data: roomName };
  }

  /**
   * Client leaving a doctor's socket room.
   */
  @SubscribeMessage('leaveDoctorRoom')
  handleLeaveDoctorRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const bodyObj = body as Record<string, unknown> | null | undefined;
    const doctorId =
      typeof body === 'string'
        ? body
        : typeof bodyObj?.doctorId === 'string'
          ? bodyObj.doctorId
          : typeof bodyObj?.id === 'string'
            ? bodyObj.id
            : undefined;
    if (!doctorId) return;
    const roomName = `doctor_${doctorId}`;
    void client.leave(roomName);
    this.logger.log(`Client ${client.id} left room ${roomName}`);
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
    this.logger.log(
      `Broadcasting queueUpdated event to room: ${roomName} (type: ${type}, doctorId: ${doctorId})`,
    );
    this.server.to(roomName).emit('queueUpdated', { type, doctorId, data });
  }
}
