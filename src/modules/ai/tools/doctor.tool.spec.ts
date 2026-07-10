import { DoctorTool } from './doctor.tool';
import { I_USER_REPOSITORY } from '../../database/interfaces/user.repository.interface';

describe('DoctorTool', () => {
  let tool: DoctorTool;
  let mockUserRepository: { findMany: jest.Mock };

  beforeEach(() => {
    mockUserRepository = { findMany: jest.fn() };
    // Manually inject the repository (bypassing @Inject decorator)
    tool = new DoctorTool(mockUserRepository as never);
    Object.defineProperty(tool, I_USER_REPOSITORY, {
      value: mockUserRepository,
      writable: true,
    });
  });

  function makeDoctor(overrides: {
    id: string;
    fullName: string;
    specialties?: string[];
  }) {
    return {
      id: overrides.id,
      fullName: overrides.fullName,
      doctorProfile: {
        specialties: overrides.specialties ?? ['General Practice'],
        bio: 'Bio text',
        yearsOfExperience: 5,
        consultationFee: 200000,
        rating: 4.5,
        services: [
          { service: { id: 'svc-1', name: 'Checkup', price: 150000 } },
        ],
      },
      workingHours: [{ dayOfWeek: 1, startTime: '08:00', endTime: '17:00' }],
      scheduleSlots: [
        {
          id: 'slot-1',
          date: new Date('2026-07-20'),
          startTime: '09:00',
          endTime: '09:30',
          maxPatients: 5,
          bookedCount: 2,
          room: { name: 'Room 101' },
        },
      ],
    };
  }

  describe('execute', () => {
    it('should return found=false when no doctors exist', async () => {
      mockUserRepository.findMany.mockResolvedValue([]);

      const result = await tool.execute({ doctorName: 'Non Existent' });

      expect(result).toMatchObject({ found: false, doctors: [] });
    });

    it('should return found=true with mapped doctor data', async () => {
      mockUserRepository.findMany.mockResolvedValue([
        makeDoctor({ id: 'd-1', fullName: 'Dr. Nguyen' }),
      ]);

      const result = await tool.execute({});

      expect(result).toMatchObject({ found: true });
      const doctors = (result as { doctors: unknown[] }).doctors;
      expect(doctors).toHaveLength(1);
      expect(doctors[0]).toMatchObject({
        doctorId: 'd-1',
        fullName: 'Dr. Nguyen',
      });
    });

    it('should filter by specialtyName if provided', async () => {
      mockUserRepository.findMany.mockResolvedValue([
        makeDoctor({
          id: 'd-1',
          fullName: 'Dr. A',
          specialties: ['Cardiology'],
        }),
        makeDoctor({
          id: 'd-2',
          fullName: 'Dr. B',
          specialties: ['Dermatology'],
        }),
      ]);

      const result = await tool.execute({ specialtyName: 'cardio' });

      const doctors = (result as { doctors: { doctorId: string }[] }).doctors;
      expect(doctors).toHaveLength(1);
      expect(doctors[0].doctorId).toBe('d-1');
    });

    it('should return found=false with descriptive message if specialty filter returns no match', async () => {
      mockUserRepository.findMany.mockResolvedValue([
        makeDoctor({
          id: 'd-1',
          fullName: 'Dr. A',
          specialties: ['Cardiology'],
        }),
      ]);

      const result = await tool.execute({ specialtyName: 'Neurology' });

      expect(result).toMatchObject({ found: false, doctors: [] });
    });

    it('should filter available slots (bookedCount < maxPatients)', async () => {
      const doctor = makeDoctor({ id: 'd-1', fullName: 'Dr. A' });
      doctor.scheduleSlots[0].bookedCount = 5; // fully booked
      mockUserRepository.findMany.mockResolvedValue([doctor]);

      const result = await tool.execute({});
      const doctors = (result as { doctors: { upcomingSlots: unknown[] }[] })
        .doctors;
      expect(doctors[0].upcomingSlots).toHaveLength(0);
    });
  });
});
