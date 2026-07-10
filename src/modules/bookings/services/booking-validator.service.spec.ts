import { Test, TestingModule } from '@nestjs/testing';
import { BookingValidatorService } from './booking-validator.service';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../database/interfaces/booking.repository.interface';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../database/interfaces/user.repository.interface';
import {
  I_CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../database/interfaces/catalog.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../../database/interfaces/profile.repository.interface';
import { DayOfWeek, UserRole, BookingStatus } from '@prisma/client';
import { ApiException } from 'src/common/exceptions/api.exception';
import { MessageCodes } from 'src/common/constants/message-codes.const';

type MockBookingRepo = Partial<Record<keyof IBookingRepository, jest.Mock>>;
type MockUserRepo = Partial<Record<keyof IUserRepository, jest.Mock>>;
type MockCatalogRepo = Partial<Record<keyof ICatalogRepository, jest.Mock>>;
type MockProfileRepo = Partial<Record<keyof IProfileRepository, jest.Mock>>;

describe('BookingValidatorService', () => {
  let service: BookingValidatorService;
  let bookingRepository: MockBookingRepo;
  let userRepository: MockUserRepo;
  let catalogRepository: MockCatalogRepo;
  let profileRepository: MockProfileRepo;

  beforeEach(async () => {
    bookingRepository = {
      findDoctorWorkingHours: jest.fn(),
      findActiveBookingForPatient: jest.fn(),
      countActiveBookingsForDoctorInSlot: jest.fn(),
      findSlotReservations: jest.fn(),
    };

    userRepository = {
      findById: jest.fn(),
    };

    catalogRepository = {
      findServiceById: jest.fn(),
    };

    profileRepository = {
      findPatientProfileById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingValidatorService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepository },
        { provide: I_USER_REPOSITORY, useValue: userRepository },
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepository },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepository },
      ],
    }).compile();

    service = module.get<BookingValidatorService>(BookingValidatorService);
  });

  describe('validateBooking', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const mockDto = {
      patientProfileId: 'patient-1',
      doctorId: 'doctor-1',
      serviceId: 'service-1',
      bookingDate: futureDateStr,
      startTime: '09:00',
      isPreBooked: true,
    };

    it('should throw BOOKING_INVALID_DATE if booking date is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      await expect(
        service.validateBooking({
          ...mockDto,
          bookingDate: pastDateStr,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.BOOKING_INVALID_DATE,
        }) as unknown,
      });
    });

    it('should throw BOOKING_INVALID_DATE if booking time is in the past for today', async () => {
      const today = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
      );
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}/${mm}/${dd}`;

      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });

      const pastHour = today.getHours() - 1;

      if (pastHour > 0) {
        const pastTime = `${String(pastHour).padStart(2, '0')}:00`;
        await expect(
          service.validateBooking({
            ...mockDto,
            bookingDate: todayStr,
            startTime: pastTime,
          }),
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            messageCode: MessageCodes.BOOKING_INVALID_DATE,
          }) as unknown,
        });
      }
    });

    it('should throw USER_NOT_FOUND if patient profile not found', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue(null);

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.USER_NOT_FOUND,
          errorMessage: 'Patient profile not found',
        }) as unknown,
      });
    });

    it('should throw USER_NOT_FOUND if doctor not found', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue(null);

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.USER_NOT_FOUND,
          errorMessage: 'Doctor not found',
        }) as unknown,
      });
    });

    it('should throw USER_NOT_FOUND if user is not a doctor', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.PATIENT,
      });

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.USER_NOT_FOUND,
          errorMessage: 'User is not a doctor',
        }) as unknown,
      });
    });

    it('should throw ACCOUNT_INACTIVE if doctor is inactive', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
        isActive: false,
      });

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.ACCOUNT_INACTIVE,
          errorMessage: 'Doctor is not active',
        }) as unknown,
      });
    });

    it('should throw SERVICE_NOT_FOUND if service not found/inactive', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
        isActive: true,
      });
      catalogRepository.findServiceById!.mockResolvedValue(null);

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.SERVICE_NOT_FOUND,
        }) as unknown,
      });
    });

    it('should throw SCHEDULE_NOT_FOUND if doctor has no working hours configured for the day', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
        isActive: true,
      });
      catalogRepository.findServiceById!.mockResolvedValue({
        id: 'service-1',
        isActive: true,
      });
      bookingRepository.findDoctorWorkingHours!.mockResolvedValue(null);

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.SCHEDULE_NOT_FOUND,
        }) as unknown,
      });
    });

    it('should throw BOOKING_INVALID_TIME if start time is outside working hours', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
        isActive: true,
      });
      catalogRepository.findServiceById!.mockResolvedValue({
        id: 'service-1',
        isActive: true,
      });
      bookingRepository.findDoctorWorkingHours!.mockResolvedValue({
        startTime: '08:00',
        endTime: '17:00',
      });

      await expect(
        service.validateBooking({
          ...mockDto,
          startTime: '18:00',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.BOOKING_INVALID_TIME,
        }) as unknown,
      });
    });

    it('should throw BOOKING_DUPLICATE if patient already has active booking', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
        isActive: true,
      });
      catalogRepository.findServiceById!.mockResolvedValue({
        id: 'service-1',
        isActive: true,
      });
      bookingRepository.findDoctorWorkingHours!.mockResolvedValue({
        startTime: '08:00',
        endTime: '17:00',
      });
      bookingRepository.findActiveBookingForPatient!.mockResolvedValue({
        id: 'existing-booking',
      });

      await expect(service.validateBooking(mockDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          messageCode: MessageCodes.BOOKING_DUPLICATE,
        }) as unknown,
      });
    });

    it('should pass validation if all checks succeed', async () => {
      profileRepository.findPatientProfileById!.mockResolvedValue({
        id: 'patient-1',
      });
      userRepository.findById!.mockResolvedValue({
        id: 'doctor-1',
        role: UserRole.DOCTOR,
        isActive: true,
      });
      catalogRepository.findServiceById!.mockResolvedValue({
        id: 'service-1',
        isActive: true,
      });
      bookingRepository.findDoctorWorkingHours!.mockResolvedValue({
        startTime: '08:00',
        endTime: '17:00',
      });
      bookingRepository.findActiveBookingForPatient!.mockResolvedValue(null);

      await expect(service.validateBooking(mockDto)).resolves.toBeUndefined();
    });
  });

  describe('checkSlotAvailability', () => {
    it('should return true if total confirmed bookings and other reservations is less than max slots', async () => {
      bookingRepository.countActiveBookingsForDoctorInSlot!.mockResolvedValue(
        1,
      );
      bookingRepository.findSlotReservations!.mockResolvedValue([
        { startTime: '09:00', patientProfileId: 'patient-2' }, // other reservation
        { startTime: '09:00', patientProfileId: 'patient-1' }, // current patient's reservation (should be ignored)
      ]);

      const result = await service.checkSlotAvailability(
        'doctor-1',
        '2026-06-01',
        '09:00',
        '09:30',
        3,
        'patient-1',
      );

      expect(result).toBe(true); // 1 active + 1 other reservation = 2 < 3 slots
      expect(
        bookingRepository.countActiveBookingsForDoctorInSlot,
      ).toHaveBeenCalledWith('doctor-1', expect.any(Date), '09:00');
    });

    it('should return false if total bookings exceed max slots', async () => {
      bookingRepository.countActiveBookingsForDoctorInSlot!.mockResolvedValue(
        2,
      );
      bookingRepository.findSlotReservations!.mockResolvedValue([
        { startTime: '09:00', patientProfileId: 'patient-2' },
      ]);

      const result = await service.checkSlotAvailability(
        'doctor-1',
        '2026-06-01',
        '09:00',
        '09:30',
        3,
        'patient-1',
      );

      expect(result).toBe(false); // 2 active + 1 other reservation = 3 == 3 slots (not less than)
    });
  });

  describe('calculateEndTime', () => {
    it('should calculate end time correctly', () => {
      expect(service.calculateEndTime('09:00', 30)).toBe('09:30');
      expect(service.calculateEndTime('23:45', 30)).toBe('24:15');
    });
  });

  describe('getDayOfWeek', () => {
    it('should return DayOfWeek enum value correctly', () => {
      const sunday = new Date('2026-05-31'); // Sunday
      expect(service.getDayOfWeek(sunday)).toBe(DayOfWeek.SUNDAY);
    });
  });

  describe('validateStatusTransition', () => {
    it('should throw BOOKING_INVALID_STATUS_TRANSITION for invalid transitions', () => {
      expect(() =>
        service.validateStatusTransition(
          BookingStatus.COMPLETED,
          BookingStatus.CONFIRMED,
        ),
      ).toThrow(ApiException);
    });

    it('should not throw for valid transitions', () => {
      expect(() =>
        service.validateStatusTransition(
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
        ),
      ).not.toThrow();
    });
  });
});
