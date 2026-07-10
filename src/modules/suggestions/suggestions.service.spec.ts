import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsService } from './suggestions.service';
import { I_USER_REPOSITORY } from '../database/interfaces/user.repository.interface';
import { I_CATALOG_REPOSITORY } from '../database/interfaces/catalog.repository.interface';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';
import { BadRequestException } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let userRepositoryMock: Record<string, jest.Mock>;
  let catalogRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    userRepositoryMock = {
      findById: jest.fn(),
      findDoctorWorkingHours: jest.fn(),
      findDoctorBreakTimesInDateRange: jest.fn(),
      findDoctorOffDaysInDateRange: jest.fn(),
    };

    catalogRepositoryMock = {
      findServiceById: jest.fn(),
    };

    bookingRepositoryMock = {
      countActiveBookingsForDoctorInSlot: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
      ],
    }).compile();

    service = module.get<SuggestionsService>(SuggestionsService);
  });

  describe('getSuggestions', () => {
    const defaultQuery = {
      doctorId: 'doc-1',
      serviceId: 'svc-1',
      startDate: '2028-12-01',
      endDate: '2028-12-03',
      limit: 5,
    };

    it('should throw BadRequestException if startDate is in the past', async () => {
      await expect(
        service.getSuggestions({
          ...defaultQuery,
          startDate: '2020-01-01',
        }),
      ).rejects.toThrow(
        new BadRequestException('Start date cannot be in the past'),
      );
    });

    it('should throw BadRequestException if endDate is before startDate', async () => {
      await expect(
        service.getSuggestions({
          ...defaultQuery,
          startDate: '2028-12-05',
          endDate: '2028-12-03',
        }),
      ).rejects.toThrow(
        new BadRequestException('End date must be after start date'),
      );
    });

    it('should throw BadRequestException if doctor not found', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);
      catalogRepositoryMock.findServiceById.mockResolvedValue({ id: 'svc-1' });

      await expect(service.getSuggestions(defaultQuery)).rejects.toThrow(
        new BadRequestException('Doctor not found'),
      );
    });

    it('should throw BadRequestException if service not found', async () => {
      userRepositoryMock.findById.mockResolvedValue({ id: 'doc-1' });
      catalogRepositoryMock.findServiceById.mockResolvedValue(null);

      await expect(service.getSuggestions(defaultQuery)).rejects.toThrow(
        new BadRequestException('Service not found'),
      );
    });

    it('should return empty suggestions with message if doctor has no working hours', async () => {
      userRepositoryMock.findById.mockResolvedValue({ id: 'doc-1' });
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-1',
        durationMinutes: 30,
      });
      userRepositoryMock.findDoctorWorkingHours.mockResolvedValue([]);

      const result = await service.getSuggestions(defaultQuery);

      expect(result).toEqual({
        suggestions: [],
        message: 'Doctor has no working hours set',
      });
    });

    it('should correctly score slots and apply preferences, limits, and filter conflicts', async () => {
      userRepositoryMock.findById.mockResolvedValue({ id: 'doc-1' });
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-1',
        durationMinutes: 30,
        maxSlotsPerHour: 2,
      });

      // Doctor works Monday-Friday 08:00 - 10:00 (which fits slots 08:00, 08:30, 09:00, 09:30)
      // 2028-12-01 is a Friday (DAYOFWEEK: FRIDAY)
      // 2028-12-02 is a Saturday (DAYOFWEEK: SATURDAY) - let's say they don't work Saturday or workingHours has it enabled
      userRepositoryMock.findDoctorWorkingHours.mockResolvedValue([
        {
          dayOfWeek: DayOfWeek.FRIDAY,
          startTime: '08:00',
          endTime: '10:00',
        },
      ]);

      // Mock break times
      userRepositoryMock.findDoctorBreakTimesInDateRange.mockResolvedValue([
        {
          breakDate: new Date('2028-12-01'),
          startTime: '09:00',
          endTime: '09:30',
        },
      ]);

      // Mock off days (2028-12-02 is off day, though doctor has no working hours on Sat anyway)
      userRepositoryMock.findDoctorOffDaysInDateRange.mockResolvedValue([
        {
          offDate: new Date('2028-12-02'),
        },
      ]);

      // Active bookings count:
      // slot 08:00 has 0 bookings -> availableSlots = 2 (fully available)
      // slot 08:30 has 1 booking -> availableSlots = 1 (good availability)
      // slot 09:30 has 2 bookings -> availableSlots = 0 (should be skipped!)
      bookingRepositoryMock.countActiveBookingsForDoctorInSlot.mockImplementation(
        (docId, date, time) => {
          if (time === '08:00') return Promise.resolve(0);
          if (time === '08:30') return Promise.resolve(1);
          if (time === '09:30') return Promise.resolve(2);
          return Promise.resolve(0);
        },
      );

      const result = await service.getSuggestions({
        ...defaultQuery,
        startDate: '2028-12-01',
        endDate: '2028-12-01', // limit to Friday
        limit: 5,
        preferMorning: true,
      });

      // 09:00 is blocked by break.
      // 09:30 is fully booked (availableSlots = 0) and thus skipped.
      // Expected slots: 08:00 and 08:30.
      expect(result.totalFound).toBe(2);
      expect(result.suggestions.length).toBe(2);

      const firstSug = result.suggestions[0];
      const secondSug = result.suggestions[1];

      // 08:00 should have a higher score than 08:30 because:
      // - 08:00 is fully available (+10) vs 08:30 (+5)
      // - both are morning slots and early morning slots
      expect(firstSug.time).toBe('08:00');
      expect(firstSug.availableSlots).toBe(2);
      expect(firstSug.reasons).toContain('Fully available');

      expect(secondSug.time).toBe('08:30');
      expect(secondSug.availableSlots).toBe(1);
      expect(secondSug.reasons).toContain('Good availability');
    });
  });
});
