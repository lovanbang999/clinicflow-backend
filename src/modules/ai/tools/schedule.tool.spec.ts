import { ScheduleTool } from './schedule.tool';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';

describe('ScheduleTool', () => {
  let tool: ScheduleTool;
  let mockBookingRepository: { findManyDoctorScheduleSlot: jest.Mock };

  beforeEach(() => {
    mockBookingRepository = { findManyDoctorScheduleSlot: jest.fn() };
    tool = new ScheduleTool(mockBookingRepository as never);
    Object.defineProperty(tool, I_BOOKING_REPOSITORY, {
      value: mockBookingRepository,
      writable: true,
    });
  });

  const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  function makeSlot(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      doctorId: VALID_UUID,
      date: new Date('2026-07-20'),
      startTime: '09:00',
      endTime: '09:30',
      maxPatients: 5,
      bookedCount: 0,
      doctor: {
        id: VALID_UUID,
        fullName: 'Dr. Smith',
        doctorProfile: {
          specialties: ['Cardiology'],
          services: [{ serviceId: VALID_UUID }],
        },
      },
      room: { name: 'Room A' },
      ...overrides,
    };
  }

  describe('execute', () => {
    it('should return empty slots with metadata instruction if doctorId is not a valid UUID', async () => {
      const result = await tool.execute({ doctorId: 'not-a-uuid' });

      expect(result).toMatchObject({
        slots: [],
        metadata: {
          message: expect.stringContaining('doctorId') as string,
        },
      });
      expect(
        mockBookingRepository.findManyDoctorScheduleSlot,
      ).not.toHaveBeenCalled();
    });

    it('should filter out slot if bookedCount is equal to or greater than maxPatients', async () => {
      mockBookingRepository.findManyDoctorScheduleSlot.mockResolvedValue([
        makeSlot('1', { bookedCount: 5, maxPatients: 5 }),
      ]);

      const result = await tool.execute({});

      expect(result.slots).toHaveLength(0);
    });

    it('should filter slots by specialtyName', async () => {
      mockBookingRepository.findManyDoctorScheduleSlot.mockResolvedValue([
        makeSlot('1'),
        makeSlot('2', {
          doctor: {
            id: VALID_UUID,
            fullName: 'Dr. Dermatologist',
            doctorProfile: {
              specialties: ['Dermatology'],
              services: [{ serviceId: VALID_UUID }],
            },
          },
        }),
      ]);

      const result = await tool.execute({ specialtyName: 'cardio' });

      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('1');
    });

    it('should filter slots by serviceId', async () => {
      const targetServiceId = 'target-service-uuid';
      mockBookingRepository.findManyDoctorScheduleSlot.mockResolvedValue([
        makeSlot('1', {
          doctor: {
            id: VALID_UUID,
            fullName: 'Dr. Smith',
            doctorProfile: {
              specialties: ['Cardiology'],
              services: [{ serviceId: targetServiceId }],
            },
          },
        }),
        makeSlot('2', {
          doctor: {
            id: VALID_UUID,
            fullName: 'Dr. Jones',
            doctorProfile: {
              specialties: ['Cardiology'],
              services: [{ serviceId: 'other-service-uuid' }],
            },
          },
        }),
      ]);

      const result = await tool.execute({ serviceId: targetServiceId });

      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].slotId).toBe('1');
    });

    it('should trigger 7-day range fallback search if single day returns no results', async () => {
      // First call (single day) returns empty
      mockBookingRepository.findManyDoctorScheduleSlot.mockResolvedValueOnce(
        [],
      );
      // Second call (range fallback) returns slot
      mockBookingRepository.findManyDoctorScheduleSlot.mockResolvedValueOnce([
        makeSlot('1'),
      ]);

      const result = await tool.execute({ date: '2026-07-20' });

      expect(result.slots).toHaveLength(1);
      expect(result.metadata.isFallbackSuggestions).toBe(true);
      expect(
        mockBookingRepository.findManyDoctorScheduleSlot,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
