import { BookingTool } from './booking.tool';
import { BookingsService } from '../../bookings/bookings.service';
import { BookingSource, BookingPriority } from '@prisma/client';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ANOTHER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('BookingTool', () => {
  let tool: BookingTool;
  let mockBookingsService: Partial<BookingsService>;

  beforeEach(() => {
    mockBookingsService = {
      create: jest.fn(),
    };
    tool = new BookingTool(mockBookingsService as BookingsService);
  });

  const validArgs = {
    patientProfileId: VALID_UUID,
    userId: ANOTHER_UUID,
    doctorId: VALID_UUID,
    serviceId: ANOTHER_UUID,
    date: '2026-07-20',
    startTime: '09:00',
  };

  describe('UUID validation', () => {
    it('should return error if patientProfileId is not a valid UUID', async () => {
      const result = await tool.execute({
        ...validArgs,
        patientProfileId: 'not-a-uuid',
      });

      expect(result).toMatchObject({ status: 'error', error: true });
      expect((result as { message: string }).message).toContain(
        'patientProfileId',
      );
    });

    it('should return error if doctorId is not a valid UUID', async () => {
      const result = await tool.execute({
        ...validArgs,
        doctorId: 'Dr. Smith',
      });

      expect(result).toMatchObject({ status: 'error', error: true });
      expect((result as { message: string }).message).toContain('doctorId');
    });

    it('should return error if serviceId is not a valid UUID', async () => {
      const result = await tool.execute({
        ...validArgs,
        serviceId: 'general-checkup',
      });

      expect(result).toMatchObject({ status: 'error', error: true });
      expect((result as { message: string }).message).toContain('serviceId');
    });
  });

  describe('successful booking creation', () => {
    it('should return success with bookingId when service returns a booking', async () => {
      const mockBooking = {
        id: 'bk-1',
        bookingCode: 'BK-001',
        bookingDate: new Date('2026-07-20'),
        startTime: '09:00',
        endTime: '09:30',
        status: 'CONFIRMED',
        source: BookingSource.ONLINE,
        priority: BookingPriority.NORMAL,
      };
      (mockBookingsService.create as jest.Mock).mockResolvedValue(mockBooking);

      const result = await tool.execute(validArgs);

      expect(result).toMatchObject({
        status: 'success',
        bookingId: 'bk-1',
        bookingCode: 'BK-001',
      });
    });

    it('should return error if service returns a result without id', async () => {
      (mockBookingsService.create as jest.Mock).mockResolvedValue({});

      const result = await tool.execute(validArgs);

      expect(result).toMatchObject({ status: 'error', error: true });
    });
  });

  describe('error handling from bookingsService', () => {
    it('should return isDuplicate=true when error code contains DUPLICATE', async () => {
      (mockBookingsService.create as jest.Mock).mockRejectedValue({
        response: {
          messageCode: 'BOOKING_DUPLICATE',
          message: 'Already exists',
        },
      });

      const result = await tool.execute(validArgs);

      expect(result).toMatchObject({ status: 'error', isDuplicate: true });
    });

    it('should return isDuplicate=true when error message contains "already has an active booking"', async () => {
      (mockBookingsService.create as jest.Mock).mockRejectedValue({
        message: 'Patient already has an active booking with this doctor',
      });

      const result = await tool.execute(validArgs);

      expect(result).toMatchObject({ status: 'error', isDuplicate: true });
    });

    it('should return slotUnavailable=true when error message contains "conflict"', async () => {
      (mockBookingsService.create as jest.Mock).mockRejectedValue({
        message: 'Slot conflict with another booking',
      });

      const result = await tool.execute(validArgs);

      expect(result).toMatchObject({ status: 'error', slotUnavailable: true });
    });

    it('should return a generic error for unknown failures', async () => {
      (mockBookingsService.create as jest.Mock).mockRejectedValue(
        new Error('Database unavailable'),
      );

      const result = await tool.execute(validArgs);

      expect(result).toMatchObject({ status: 'error', error: true });
      expect(
        (result as { slotUnavailable: boolean }).slotUnavailable,
      ).toBeFalsy();
      expect((result as { isDuplicate: boolean }).isDuplicate).toBeFalsy();
    });
  });
});
