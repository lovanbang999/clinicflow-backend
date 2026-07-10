import { QueueGateway } from './queue.gateway';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';

describe('QueueGateway', () => {
  let gateway: QueueGateway;
  let mockAuthService: Partial<AuthService>;
  let mockServer: { to: jest.Mock };
  let mockRoom: { emit: jest.Mock };

  beforeEach(() => {
    mockAuthService = {
      verifyAccessToken: jest.fn(),
      validateUser: jest.fn(),
    };

    gateway = new QueueGateway(mockAuthService as AuthService);
    mockRoom = { emit: jest.fn() };
    mockServer = { to: jest.fn().mockReturnValue(mockRoom) };
    gateway.server = mockServer as never;
  });

  describe('broadcastQueueUpdate', () => {
    it('should emit queueUpdated to the correct doctor room', () => {
      gateway.broadcastQueueUpdate('doctor-1', 'CHECK_IN', {
        bookingId: 'b-1',
      });

      expect(mockServer.to).toHaveBeenCalledWith('doctor_doctor-1');
      expect(mockRoom.emit).toHaveBeenCalledWith('queueUpdated', {
        type: 'CHECK_IN',
        doctorId: 'doctor-1',
        data: { bookingId: 'b-1' },
      });
    });

    it('should support all event types', () => {
      gateway.broadcastQueueUpdate('d-2', 'PROMOTED', { queue: 1 });
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'queueUpdated',
        expect.objectContaining({ type: 'PROMOTED', doctorId: 'd-2' }),
      );

      gateway.broadcastQueueUpdate('d-3', 'NO_SHOW', {});
      expect(mockRoom.emit).toHaveBeenCalledWith(
        'queueUpdated',
        expect.objectContaining({ type: 'NO_SHOW', doctorId: 'd-3' }),
      );
    });
  });

  describe('handleJoinDoctorRoom', () => {
    function makeClient(user?: { id: string; role: UserRole; email: string }) {
      return {
        id: 'socket-1',
        join: jest.fn().mockResolvedValue(undefined),
        data: { user },
      };
    }

    it('should return error if doctorId is missing', () => {
      const client = makeClient({
        id: 'u-1',
        role: UserRole.RECEPTIONIST,
        email: 'r@c.com',
      });

      const result = gateway.handleJoinDoctorRoom(client as never, {});
      expect(result).toEqual({ event: 'error', data: 'Missing doctor ID' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should return error if user is not authenticated', () => {
      const client = makeClient(undefined);

      const result = gateway.handleJoinDoctorRoom(client as never, {
        doctorId: 'doc-1',
      });
      expect(result).toEqual({ event: 'error', data: 'Unauthorized' });
    });

    it('should deny DOCTOR trying to join another doctor room', () => {
      const client = makeClient({
        id: 'my-doc-id',
        role: UserRole.DOCTOR,
        email: 'doc@c.com',
      });

      const result = gateway.handleJoinDoctorRoom(client as never, {
        doctorId: 'other-doc-id',
      });
      expect(result).toEqual({
        event: 'error',
        data: 'Forbidden: You can only join your own queue',
      });
    });

    it('should deny PATIENT from joining any doctor room', () => {
      const client = makeClient({
        id: 'p-1',
        role: UserRole.PATIENT,
        email: 'p@c.com',
      });

      const result = gateway.handleJoinDoctorRoom(client as never, {
        doctorId: 'doc-1',
      });
      expect(result).toEqual({
        event: 'error',
        data: 'Forbidden: Patients cannot join doctor queue room',
      });
    });

    it('should allow RECEPTIONIST to join any doctor room', () => {
      const client = makeClient({
        id: 'r-1',
        role: UserRole.RECEPTIONIST,
        email: 'r@c.com',
      });

      const result = gateway.handleJoinDoctorRoom(client as never, {
        doctorId: 'doc-42',
      });
      expect(client.join).toHaveBeenCalledWith('doctor_doc-42');
      expect(result).toEqual({ event: 'roomJoined', data: 'doctor_doc-42' });
    });

    it('should allow DOCTOR to join their own room', () => {
      const client = makeClient({
        id: 'my-doc',
        role: UserRole.DOCTOR,
        email: 'doc@c.com',
      });

      const result = gateway.handleJoinDoctorRoom(client as never, {
        doctorId: 'my-doc',
      });
      expect(client.join).toHaveBeenCalledWith('doctor_my-doc');
      expect(result).toEqual({ event: 'roomJoined', data: 'doctor_my-doc' });
    });

    it('should parse doctorId from a plain string body', () => {
      const client = makeClient({
        id: 'r-2',
        role: UserRole.RECEPTIONIST,
        email: 'r@c.com',
      });

      const result = gateway.handleJoinDoctorRoom(
        client as never,
        'doc-string-id' as never,
      );
      expect(client.join).toHaveBeenCalledWith('doctor_doc-string-id');
      expect(result).toEqual({
        event: 'roomJoined',
        data: 'doctor_doc-string-id',
      });
    });
  });

  describe('handleLeaveDoctorRoom', () => {
    it('should leave the correct doctor room', () => {
      const client = {
        id: 'socket-2',
        leave: jest.fn().mockResolvedValue(undefined),
      };

      const result = gateway.handleLeaveDoctorRoom(client as never, {
        doctorId: 'doc-99',
      });
      expect(client.leave).toHaveBeenCalledWith('doctor_doc-99');
      expect(result).toEqual({ event: 'roomLeft', data: 'doctor_doc-99' });
    });

    it('should return undefined if doctorId is missing', () => {
      const client = { id: 'socket-3', leave: jest.fn() };

      const result = gateway.handleLeaveDoctorRoom(client as never, {});
      expect(client.leave).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('lifecycle hooks', () => {
    it('handleConnection should not throw', () => {
      expect(() =>
        gateway.handleConnection({
          id: 'c-1',
          data: { user: { id: 'u', email: 'u@c', role: 'DOCTOR' } },
        } as never),
      ).not.toThrow();
    });

    it('handleConnection should not throw when user is undefined', () => {
      expect(() =>
        gateway.handleConnection({ id: 'c-2', data: {} } as never),
      ).not.toThrow();
    });

    it('handleDisconnect should not throw', () => {
      expect(() =>
        gateway.handleDisconnect({ id: 'c-3' } as never),
      ).not.toThrow();
    });
  });
});
