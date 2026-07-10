import { MyBookingsTool } from './my-bookings.tool';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { BookingStatus } from '@prisma/client';

describe('MyBookingsTool', () => {
  let tool: MyBookingsTool;
  let mockBookingRepository: { findManyBooking: jest.Mock };

  beforeEach(() => {
    mockBookingRepository = { findManyBooking: jest.fn() };
    tool = new MyBookingsTool(mockBookingRepository as never);
    Object.defineProperty(tool, I_BOOKING_REPOSITORY, {
      value: mockBookingRepository,
      writable: true,
    });
  });

  function makeBooking(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      bookingCode: `BK-${id}`,
      bookingDate: new Date('2026-07-20'),
      startTime: '09:00',
      endTime: '09:30',
      status: BookingStatus.CONFIRMED,
      patientNotes: 'Checkup notes',
      doctor: { fullName: 'Dr. John' },
      service: { name: 'General Consultation' },
      room: { name: 'Room 202' },
      ...overrides,
    };
  }

  describe('execute', () => {
    it('should return found=false when booking repository returns empty list', async () => {
      mockBookingRepository.findManyBooking.mockResolvedValue([]);

      const result = await tool.execute({ patientProfileId: 'profile-1' });

      expect(result).toMatchObject({ found: false, bookings: [] });
    });

    it('should query active bookings by default (filtering by status in ACTIVE_STATUSES)', async () => {
      mockBookingRepository.findManyBooking.mockResolvedValue([
        makeBooking('1'),
      ]);

      const result = await tool.execute({ patientProfileId: 'profile-1' });

      expect(result).toMatchObject({ found: true, count: 1 });
      const bookings = (result as { bookings: { bookingId: string }[] })
        .bookings;
      expect(bookings[0].bookingId).toBe('1');

      // Verify repository call includes status filter
      const callArgs = (
        mockBookingRepository.findManyBooking.mock.calls as unknown[][]
      )[0][0] as {
        where: { status?: unknown };
      };
      expect(callArgs.where.status).toBeDefined();
    });

    it('should bypass status filter when includeAll is true', async () => {
      mockBookingRepository.findManyBooking.mockResolvedValue([
        makeBooking('1', { status: BookingStatus.COMPLETED }),
      ]);

      const result = await tool.execute({
        patientProfileId: 'profile-1',
        includeAll: true,
      });

      expect(result).toMatchObject({ found: true });
      const callArgs = (
        mockBookingRepository.findManyBooking.mock.calls as unknown[][]
      )[0][0] as {
        where: { status?: unknown };
      };
      expect(callArgs.where.status).toBeUndefined();
    });
  });
});
