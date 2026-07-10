import { NotificationsGateway } from './notifications.gateway';
import { UserRole } from '@prisma/client';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let mockServer: { to: jest.Mock };
  let mockRoom: { emit: jest.Mock };

  beforeEach(() => {
    gateway = new NotificationsGateway();
    mockRoom = { emit: jest.fn() };
    mockServer = { to: jest.fn().mockReturnValue(mockRoom) };
    gateway.server = mockServer as never;
  });

  describe('sendToUser', () => {
    it('should emit newNotification to the correct user room', () => {
      const payload = { id: 'n1', message: 'Test' };

      gateway.sendToUser('user-abc', payload);

      expect(mockServer.to).toHaveBeenCalledWith('user_user-abc');
      expect(mockRoom.emit).toHaveBeenCalledWith('newNotification', payload);
    });

    it('should build the room name using user_ prefix', () => {
      gateway.sendToUser('uuid-999', { message: 'hello' });

      expect(mockServer.to).toHaveBeenCalledWith('user_uuid-999');
    });
  });

  describe('broadcastToRole', () => {
    it('should emit newNotification to the correct role room', () => {
      const payload = { id: 'n2', message: 'Role broadcast' };

      gateway.broadcastToRole(UserRole.DOCTOR, payload);

      expect(mockServer.to).toHaveBeenCalledWith('role_DOCTOR');
      expect(mockRoom.emit).toHaveBeenCalledWith('newNotification', payload);
    });

    it('should use the role string as room suffix', () => {
      gateway.broadcastToRole(UserRole.ADMIN, { message: 'admin event' });

      expect(mockServer.to).toHaveBeenCalledWith('role_ADMIN');
    });
  });

  describe('handleAuthenticate', () => {
    let mockClient: { join: jest.Mock; id: string };

    beforeEach(() => {
      mockClient = {
        join: jest.fn().mockResolvedValue(undefined),
        id: 'socket-1',
      };
    });

    it('should return early if userId is empty', () => {
      const result = gateway.handleAuthenticate(mockClient as never, {
        userId: '',
      });

      expect(result).toBeUndefined();
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('should join user room and return authenticated event', () => {
      const result = gateway.handleAuthenticate(mockClient as never, {
        userId: 'u-1',
      });

      expect(mockClient.join).toHaveBeenCalledWith('user_u-1');
      expect(result).toEqual({
        event: 'authenticated',
        data: { userId: 'u-1', role: undefined },
      });
    });

    it('should join user room AND role room if role is provided', () => {
      const result = gateway.handleAuthenticate(mockClient as never, {
        userId: 'u-2',
        role: UserRole.RECEPTIONIST,
      });

      expect(mockClient.join).toHaveBeenCalledWith('user_u-2');
      expect(mockClient.join).toHaveBeenCalledWith('role_RECEPTIONIST');
      expect(result).toEqual({
        event: 'authenticated',
        data: { userId: 'u-2', role: UserRole.RECEPTIONIST },
      });
    });

    it('should handle string-form data by extracting userId', () => {
      // When data is a plain string (legacy socket clients)
      const result = gateway.handleAuthenticate(
        mockClient as never,
        'u-3' as never,
      );

      expect(mockClient.join).toHaveBeenCalledWith('user_u-3');
      expect(result).toEqual({
        event: 'authenticated',
        data: { userId: 'u-3', role: undefined },
      });
    });
  });

  describe('lifecycle hooks', () => {
    it('should not throw on handleConnection', () => {
      expect(() =>
        gateway.handleConnection({ id: 'socket-x' } as never),
      ).not.toThrow();
    });

    it('should not throw on handleDisconnect', () => {
      expect(() =>
        gateway.handleDisconnect({ id: 'socket-y' } as never),
      ).not.toThrow();
    });
  });
});
