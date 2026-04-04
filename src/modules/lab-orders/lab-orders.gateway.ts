import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

const LAB_ROOM = 'lab_technicians';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/lab-orders',
})
@Injectable()
export class LabOrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LabOrdersGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Lab client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Lab client disconnected: ${client.id}`);
  }

  /** KTV joins the shared lab room to receive all new lab order events */
  @SubscribeMessage('joinLabRoom')
  handleJoinLabRoom(@ConnectedSocket() client: Socket) {
    void client.join(LAB_ROOM);
    this.logger.debug(`Client ${client.id} joined ${LAB_ROOM}`);
    return { event: 'labRoomJoined', data: LAB_ROOM };
  }

  /** Doctor joins a booking-specific room to receive lab result notifications */
  @SubscribeMessage('joinBookingLabRoom')
  handleJoinBookingLabRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() bookingId: string,
  ) {
    if (!bookingId) return;
    const room = `lab_booking_${bookingId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} joined booking lab room ${room}`);
    return { event: 'bookingLabRoomJoined', data: room };
  }

  /** Doctor leaves a booking-specific room */
  @SubscribeMessage('leaveBookingLabRoom')
  handleLeaveBookingLabRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() bookingId: string,
  ) {
    if (!bookingId) return;
    const room = `lab_booking_${bookingId}`;
    void client.leave(room);
    this.logger.debug(`Client ${client.id} left booking lab room ${room}`);
    return { event: 'bookingLabRoomLeft', data: room };
  }

  /**
   * Broadcast to all connected technicians that new lab orders are ready.
   * Called by BillingService after a LAB invoice is PAID.
   */
  broadcastNewLabOrder(payload: {
    labOrderIds: string[];
    patientName: string;
    invoiceId: string;
  }) {
    this.server.to(LAB_ROOM).emit('newLabOrder', payload);
    this.logger.debug(
      `Broadcast newLabOrder to ${LAB_ROOM}: ${payload.labOrderIds.join(', ')}`,
    );
  }

  /**
   * Broadcast to the doctor viewing a specific booking that a lab result is ready.
   * Called by LabOrdersService after a technician submits a result.
   */
  broadcastLabResultCompleted(
    bookingId: string,
    payload: { labOrderId: string; testName: string },
  ) {
    const room = `lab_booking_${bookingId}`;
    this.server.to(room).emit('labResultCompleted', payload);
    this.logger.debug(
      `Broadcast labResultCompleted to ${room}: ${payload.labOrderId}`,
    );
  }
}
