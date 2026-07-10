import { LabOrdersGateway } from './lab-orders.gateway';

describe('LabOrdersGateway', () => {
  let gateway: LabOrdersGateway;
  let mockServer: { to: jest.Mock };
  let mockRoom: { emit: jest.Mock };

  beforeEach(() => {
    gateway = new LabOrdersGateway();
    mockRoom = { emit: jest.fn() };
    mockServer = { to: jest.fn().mockReturnValue(mockRoom) };
    gateway.server = mockServer as never;
  });

  describe('broadcastNewLabOrder', () => {
    it('should emit newLabOrder to lab_technicians room with correct payload', () => {
      const payload = {
        labOrderIds: ['lo-1', 'lo-2'],
        patientName: 'Nguyen Van A',
        invoiceId: 'inv-1',
      };

      gateway.broadcastNewLabOrder(payload);

      expect(mockServer.to).toHaveBeenCalledWith('lab_technicians');
      expect(mockRoom.emit).toHaveBeenCalledWith('newLabOrder', payload);
    });
  });

  describe('broadcastLabResultCompleted', () => {
    it('should emit labResultCompleted to the correct booking room', () => {
      const payload = { labOrderId: 'lo-3', testName: 'CBC' };

      gateway.broadcastLabResultCompleted('booking-42', payload);

      expect(mockServer.to).toHaveBeenCalledWith('lab_booking_booking-42');
      expect(mockRoom.emit).toHaveBeenCalledWith('labResultCompleted', payload);
    });
  });

  describe('handleJoinLabRoom', () => {
    it('should join the lab_technicians room and return the join event', () => {
      const mockClient = {
        join: jest.fn().mockResolvedValue(undefined),
        id: 's-1',
      };

      const result = gateway.handleJoinLabRoom(mockClient as never);

      expect(mockClient.join).toHaveBeenCalledWith('lab_technicians');
      expect(result).toEqual({
        event: 'labRoomJoined',
        data: 'lab_technicians',
      });
    });
  });

  describe('handleJoinBookingLabRoom', () => {
    it('should join the booking-specific lab room and return the event', () => {
      const mockClient = {
        join: jest.fn().mockResolvedValue(undefined),
        id: 's-2',
      };

      const result = gateway.handleJoinBookingLabRoom(
        mockClient as never,
        'bk-99',
      );

      expect(mockClient.join).toHaveBeenCalledWith('lab_booking_bk-99');
      expect(result).toEqual({
        event: 'bookingLabRoomJoined',
        data: 'lab_booking_bk-99',
      });
    });

    it('should return undefined if bookingId is empty', () => {
      const mockClient = { join: jest.fn(), id: 's-3' };

      const result = gateway.handleJoinBookingLabRoom(mockClient as never, '');

      expect(mockClient.join).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('handleLeaveBookingLabRoom', () => {
    it('should leave the booking-specific lab room and return the event', () => {
      const mockClient = {
        leave: jest.fn().mockResolvedValue(undefined),
        id: 's-4',
      };

      const result = gateway.handleLeaveBookingLabRoom(
        mockClient as never,
        'bk-55',
      );

      expect(mockClient.leave).toHaveBeenCalledWith('lab_booking_bk-55');
      expect(result).toEqual({
        event: 'bookingLabRoomLeft',
        data: 'lab_booking_bk-55',
      });
    });

    it('should return undefined if bookingId is empty', () => {
      const mockClient = { leave: jest.fn(), id: 's-5' };

      const result = gateway.handleLeaveBookingLabRoom(mockClient as never, '');

      expect(mockClient.leave).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('lifecycle hooks', () => {
    it('should not throw on handleConnection', () => {
      expect(() =>
        gateway.handleConnection({ id: 'c1' } as never),
      ).not.toThrow();
    });

    it('should not throw on handleDisconnect', () => {
      expect(() =>
        gateway.handleDisconnect({ id: 'c2' } as never),
      ).not.toThrow();
    });
  });
});
