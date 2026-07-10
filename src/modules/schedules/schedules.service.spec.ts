import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesService } from './schedules.service';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';
import { I_USER_REPOSITORY } from '../database/interfaces/user.repository.interface';
import { I_CATALOG_REPOSITORY } from '../database/interfaces/catalog.repository.interface';
import { RedisService } from '../database/services/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { MessageCodes } from '../../common/constants/message-codes.const';
import {
  DayOfWeek,
  UserRole,
  OffDayStatus,
  BookingStatus,
} from '@prisma/client';

interface Slot {
  time: string;
  bookedCount: number;
  maxSlots: number;
  available: boolean;
}

interface AvailableSlotsResult {
  availableSlots: Slot[];
  total: number;
  message?: string;
}

describe('SchedulesService', () => {
  let service: SchedulesService;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;
  let catalogRepositoryMock: Record<string, jest.Mock>;
  let redisServiceMock: Record<string, jest.Mock>;
  let notificationsServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    bookingRepositoryMock = {
      findDoctorWorkingHours: jest.fn(),
      updateDoctorWorkingHours: jest.fn(),
      createDoctorWorkingHours: jest.fn(),
      findWorkingHoursList: jest.fn(),
      deleteDoctorWorkingHours: jest.fn(),
      createDoctorBreakTime: jest.fn(),
      findDoctorBreakTimes: jest.fn(),
      deleteDoctorBreakTime: jest.fn(),
      findAffectedBookingsForDateRange: jest.fn(),
      createDoctorOffDayTransaction: jest.fn(),
      findDoctorOffDays: jest.fn(),
      findDoctorOffDay: jest.fn(),
      deleteDoctorOffDay: jest.fn(),
      findBookingsByDoctorAndDate: jest.fn(),
      findSlotReservations: jest.fn(),
      findSlotReservation: jest.fn(),
      deleteSlotReservation: jest.fn(),
      createSlotReservation: jest.fn(),
      deleteSlotReservationByDetails: jest.fn(),
      bulkUpdateDoctorWorkingHoursTransaction: jest.fn(),
      findPendingOffDaysWithDoctor: jest.fn(),
      findDoctorOffDayById: jest.fn(),
      updateBookingStatusTransaction: jest.fn(),
      updateDoctorOffDay: jest.fn(),
    };

    userRepositoryMock = {
      findById: jest.fn(),
      findByIdWithProfile: jest.fn(),
    };

    catalogRepositoryMock = {
      findServiceById: jest.fn(),
    };

    redisServiceMock = {
      isReady: jest.fn().mockReturnValue(false),
      delPattern: jest.fn(),
    };

    notificationsServiceMock = {
      notifyAdmins: jest.fn(),
      sendBookingCancellation: jest.fn(),
      createInAppNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
  });

  describe('createWorkingHours', () => {
    const dto = {
      doctorId: 'doc-1',
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '08:00',
      endTime: '17:00',
    };

    it('should throw ApiException if doctor not found or is not DOCTOR', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.createWorkingHours(dto)).rejects.toThrow(
        new ApiException(
          MessageCodes.USER_NOT_FOUND,
          'Doctor not found',
          404,
          'Working hours creation failed',
        ),
      );

      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.PATIENT,
      });
      await expect(service.createWorkingHours(dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw BadRequestException if startTime >= endTime', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      await expect(
        service.createWorkingHours({
          ...dto,
          startTime: '17:00',
          endTime: '08:00',
        }),
      ).rejects.toThrow(
        new BadRequestException('Start time must be before end time'),
      );
    });

    it('should update working hours if they exist already', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue({
        id: 'wh-1',
      });
      bookingRepositoryMock.updateDoctorWorkingHours.mockResolvedValue({
        id: 'wh-1',
        startTime: '08:00',
        endTime: '17:00',
      });

      const result = await service.createWorkingHours(dto);

      expect(
        bookingRepositoryMock.updateDoctorWorkingHours,
      ).toHaveBeenCalledWith('doc-1', DayOfWeek.MONDAY, {
        startTime: '08:00',
        endTime: '17:00',
      });
      expect(result).toBeDefined();
    });

    it('should create new working hours if none exist', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue(null);
      bookingRepositoryMock.createDoctorWorkingHours.mockResolvedValue({
        id: 'wh-new',
      });

      const result = await service.createWorkingHours(dto);

      expect(
        bookingRepositoryMock.createDoctorWorkingHours,
      ).toHaveBeenCalledWith({
        doctor: { connect: { id: 'doc-1' } },
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '17:00',
      });
      expect(result).toBeDefined();
    });
  });

  describe('getWorkingHours', () => {
    it('should return working hours for a doctor', async () => {
      bookingRepositoryMock.findWorkingHoursList.mockResolvedValue([
        { id: 'wh-1' },
      ]);
      const result = await service.getWorkingHours('doc-1');
      expect(bookingRepositoryMock.findWorkingHoursList).toHaveBeenCalledWith(
        'doc-1',
      );
      expect(result).toEqual([{ id: 'wh-1' }]);
    });
  });

  describe('deleteWorkingHours', () => {
    it('should throw ApiException if working hours do not exist', async () => {
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue(null);
      await expect(
        service.deleteWorkingHours('doc-1', DayOfWeek.MONDAY),
      ).rejects.toThrow(
        new ApiException(
          MessageCodes.SCHEDULE_NOT_FOUND,
          'Working hours not found',
          404,
          'Deletion failed',
        ),
      );
    });

    it('should delete working hours and invalidate slots cache', async () => {
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue({
        id: 'wh-1',
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.deleteWorkingHours(
        'doc-1',
        DayOfWeek.MONDAY,
      );

      expect(
        bookingRepositoryMock.deleteDoctorWorkingHours,
      ).toHaveBeenCalledWith('doc-1', DayOfWeek.MONDAY);
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:*',
      );
      expect(result).toBeNull();
    });
  });

  describe('createBreakTime', () => {
    const dto = {
      doctorId: 'doc-1',
      date: '2028-12-01',
      startTime: '12:00',
      endTime: '13:00',
      reason: 'Lunch',
    };

    it('should throw ApiException if doctor not found or not DOCTOR', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);
      await expect(service.createBreakTime(dto)).rejects.toThrow(ApiException);
    });

    it('should throw BadRequestException if startTime >= endTime', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      await expect(
        service.createBreakTime({
          ...dto,
          startTime: '13:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(
        new BadRequestException('Start time must be before end time'),
      );
    });

    it('should throw BadRequestException if date is in the past', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      await expect(
        service.createBreakTime({ ...dto, date: '2020-01-01' }),
      ).rejects.toThrow(
        new BadRequestException('Cannot create break time for past dates'),
      );
    });

    it('should create break time successfully and invalidate cache', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.createDoctorBreakTime.mockResolvedValue({
        id: 'bt-1',
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.createBreakTime(dto);

      expect(bookingRepositoryMock.createDoctorBreakTime).toHaveBeenCalledWith({
        data: {
          doctorId: 'doc-1',
          breakDate: new Date(dto.date),
          startTime: '12:00',
          endTime: '13:00',
          reason: 'Lunch',
        },
      });
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:2028-12-01:*',
      );
      expect(result).toEqual({ id: 'bt-1' });
    });
  });

  describe('getBreakTimes', () => {
    it('should return break times within range', async () => {
      bookingRepositoryMock.findDoctorBreakTimes.mockResolvedValue([
        { id: 'bt-1' },
      ]);
      const result = await service.getBreakTimes(
        'doc-1',
        '2028-12-01',
        '2028-12-02',
      );
      expect(bookingRepositoryMock.findDoctorBreakTimes).toHaveBeenCalledWith(
        'doc-1',
        new Date('2028-12-01'),
        new Date('2028-12-02'),
      );
      expect(result).toEqual([{ id: 'bt-1' }]);
    });
  });

  describe('deleteBreakTime', () => {
    it('should throw ApiException if break time does not exist', async () => {
      bookingRepositoryMock.deleteDoctorBreakTime.mockRejectedValue(
        new Error('not found'),
      );
      await expect(service.deleteBreakTime('bt-1')).rejects.toThrow(
        new ApiException(
          MessageCodes.SCHEDULE_NOT_FOUND,
          'Break time not found',
          404,
          'Deletion failed',
        ),
      );
    });

    it('should delete break time and invalidate slots cache', async () => {
      bookingRepositoryMock.deleteDoctorBreakTime.mockResolvedValue({
        id: 'bt-1',
        doctorId: 'doc-1',
        breakDate: new Date('2028-12-01'),
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.deleteBreakTime('bt-1');

      expect(bookingRepositoryMock.deleteDoctorBreakTime).toHaveBeenCalledWith(
        'bt-1',
      );
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:2028-12-01:*',
      );
      expect(result).toBeNull();
    });
  });

  describe('previewOffDay', () => {
    it('should throw ApiException if doctor not found or not DOCTOR', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);
      await expect(
        service.previewOffDay('doc-1', '2028-12-01'),
      ).rejects.toThrow(ApiException);
    });

    it('should throw BadRequestException if date is in the past', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      await expect(
        service.previewOffDay('doc-1', '2020-01-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return affected appointments', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.findAffectedBookingsForDateRange.mockResolvedValue([
        {
          id: 'bk-1',
          patientProfile: { fullName: 'John Doe', phone: '123' },
          service: { name: 'Checkup' },
          startTime: '09:00',
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.previewOffDay('doc-1', '2028-12-01');

      expect(result.affectedAppointments).toEqual([
        {
          id: 'bk-1',
          patientName: 'John Doe',
          patientPhone: '123',
          serviceName: 'Checkup',
          startTime: '09:00',
          status: 'CONFIRMED',
        },
      ]);
    });
  });

  describe('createOffDay', () => {
    const dto = {
      doctorId: 'doc-1',
      date: '2028-12-01',
      reason: 'Vacation',
      cancelAffected: false,
    };

    it('should throw ApiException if doctor not found or not DOCTOR', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);
      await expect(service.createOffDay(dto)).rejects.toThrow(ApiException);
    });

    it('should throw BadRequestException if date is in the past', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      await expect(
        service.createOffDay({ ...dto, date: '2020-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ApiException if off day already exists', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue({ id: 'od-1' });

      await expect(service.createOffDay(dto)).rejects.toThrow(
        new ApiException(
          MessageCodes.SCHEDULE_CONFLICT,
          'Off day already exists for this date',
          409,
          'Off day creation failed',
        ),
      );
    });

    it('should create pending off day, notify admins, and invalidate cache', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        fullName: 'Dr. House',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue(null);
      bookingRepositoryMock.findAffectedBookingsForDateRange.mockResolvedValue(
        [],
      );
      bookingRepositoryMock.createDoctorOffDayTransaction.mockResolvedValue({
        id: 'od-1',
        doctorId: 'doc-1',
        offDate: new Date('2028-12-01'),
        reason: 'Vacation',
        status: OffDayStatus.PENDING,
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.createOffDay(dto);

      expect(
        bookingRepositoryMock.createDoctorOffDayTransaction,
      ).toHaveBeenCalled();
      expect(notificationsServiceMock.notifyAdmins).toHaveBeenCalled();
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:2028-12-01:*',
      );
      expect(result.status).toBe(OffDayStatus.PENDING);
    });
  });

  describe('getOffDays', () => {
    it('should return off days list', async () => {
      bookingRepositoryMock.findDoctorDoctorOffDays = jest.fn(); // wait, the service calls findDoctorOffDays
      bookingRepositoryMock.findDoctorOffDays.mockResolvedValue([
        {
          id: 'od-1',
          doctorId: 'doc-1',
          offDate: new Date('2028-12-01'),
          reason: 'Vacation',
          status: OffDayStatus.APPROVED,
        },
      ]);

      const result = await service.getOffDays(
        'doc-1',
        '2028-12-01',
        '2028-12-02',
      );
      expect(result).toEqual([
        {
          id: 'od-1',
          doctorId: 'doc-1',
          date: '2028-12-01',
          reason: 'Vacation',
          status: OffDayStatus.APPROVED,
        },
      ]);
    });
  });

  describe('deleteOffDay', () => {
    it('should throw ApiException if off day not found', async () => {
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue(null);
      await expect(service.deleteOffDay('doc-1', '2028-12-01')).rejects.toThrow(
        new ApiException(
          MessageCodes.SCHEDULE_NOT_FOUND,
          'Off day not found',
          404,
          'Deletion failed',
        ),
      );
    });

    it('should delete off day and invalidate cache', async () => {
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue({ id: 'od-1' });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.deleteOffDay('doc-1', '2028-12-01');

      expect(bookingRepositoryMock.deleteDoctorOffDay).toHaveBeenCalledWith(
        'doc-1',
        new Date('2028-12-01'),
      );
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:2028-12-01:*',
      );
      expect(result).toBeNull();
    });
  });

  describe('getAvailableSlots', () => {
    const query = {
      doctorId: 'doc-1',
      date: '2028-12-01',
      serviceId: 'svc-1',
    };

    it('should throw ApiException if service not found', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue(null);
      await expect(service.getAvailableSlots(query)).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Available slots retrieval failed',
        ),
      );
    });

    it('should return empty list with msg if doctor has no working hours', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        durationMinutes: 30,
        maxSlotsPerHour: 2,
      });
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue(null);

      const result = (await service.getAvailableSlots(
        query,
      )) as AvailableSlotsResult;

      expect(result.availableSlots).toEqual([]);
      expect(result.message).toBe('Doctor does not work on this day');
    });

    it('should return empty list if doctor is on approved off day', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        durationMinutes: 30,
        maxSlotsPerHour: 2,
      });
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue({
        startTime: '08:00',
        endTime: '12:00',
      });
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue({
        status: OffDayStatus.APPROVED,
        reason: 'Sick',
      });

      const result = (await service.getAvailableSlots(
        query,
      )) as AvailableSlotsResult;

      expect(result.availableSlots).toEqual([]);
      expect(result.message).toContain('Doctor is not available');
    });

    it('should generate slots and exclude break times and booking capacity correctly', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        durationMinutes: 30,
        maxSlotsPerHour: 1,
      });
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue({
        startTime: '08:00',
        endTime: '10:00',
        breakStartTime: '09:00',
        breakEndTime: '09:30',
      });
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue(null);
      bookingRepositoryMock.findDoctorBreakTimes.mockResolvedValue([
        // add one more break time from 08:00 to 08:30
        { startTime: '08:00', endTime: '08:30' },
      ]);
      bookingRepositoryMock.findBookingsByDoctorAndDate.mockResolvedValue([
        { startTime: '09:30', patientProfileId: 'other' },
      ]);
      bookingRepositoryMock.findSlotReservations.mockResolvedValue([]);

      const result = (await service.getAvailableSlots(
        query,
      )) as AvailableSlotsResult;

      // Remaining slot should be 08:30 (since 08:00-08:30 is break, 09:00-09:30 is break, 09:30 is booked)
      expect(result.availableSlots).toEqual([
        {
          time: '08:30',
          bookedCount: 0,
          maxSlots: 1,
          available: true,
        },
        {
          time: '09:30',
          bookedCount: 1,
          maxSlots: 1,
          available: false,
        },
      ]);
    });

    it('should filter past slots if querying for today', async () => {
      // Mock Date or get today's date formatted
      const todayStr = new Date().toISOString().split('T')[0];
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        durationMinutes: 30,
        maxSlotsPerHour: 1,
      });
      bookingRepositoryMock.findDoctorWorkingHours.mockResolvedValue({
        startTime: '00:00',
        endTime: '23:59',
      });
      bookingRepositoryMock.findDoctorOffDay.mockResolvedValue(null);
      bookingRepositoryMock.findDoctorBreakTimes.mockResolvedValue([]);
      bookingRepositoryMock.findBookingsByDoctorAndDate.mockResolvedValue([]);
      bookingRepositoryMock.findSlotReservations.mockResolvedValue([]);

      const result = (await service.getAvailableSlots({
        ...query,
        date: todayStr,
      })) as AvailableSlotsResult;

      // Some slots before current time should have available = false
      const currentHour = new Date().getHours();
      if (currentHour > 1) {
        const earlySlot = result.availableSlots.find(
          (s: Slot) => parseInt(s.time.split(':')[0]) < currentHour - 1,
        );
        if (earlySlot) {
          expect(earlySlot.available).toBe(false);
        }
      }
    });
  });

  describe('reserveSlot', () => {
    const user = { id: 'usr-1', role: UserRole.PATIENT };
    const date = '2028-12-01';

    it('should throw forbidden if patient reserves for another profile', async () => {
      userRepositoryMock.findByIdWithProfile.mockResolvedValue({
        patientProfile: { id: 'profile-own' },
      });

      await expect(
        service.reserveSlot(
          'doc-1',
          date,
          '09:00',
          'profile-other',
          user as unknown as Parameters<SchedulesService['reserveSlot']>[4],
        ),
      ).rejects.toThrow(
        new ApiException(
          'SCHEDULE.FORBIDDEN',
          'You can only reserve slots for your own profile',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw bad request if reserving a past slot on today', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      await expect(
        service.reserveSlot('doc-1', todayStr, '00:01', 'profile-own', {
          id: 'usr-1',
          role: UserRole.ADMIN,
        } as unknown as Parameters<SchedulesService['reserveSlot']>[4]),
      ).rejects.toThrow(
        new ApiException(
          'SCHEDULE.PAST_TIME_SLOT',
          'Cannot reserve a time slot that has already passed',
          HttpStatus.BAD_REQUEST,
          'SchedulesService.reserveSlot',
        ),
      );
    });

    it('should throw conflict if slot is locked by another user', async () => {
      bookingRepositoryMock.findSlotReservation.mockResolvedValue({
        id: 'res-1',
        patientProfileId: 'profile-other',
      });

      await expect(
        service.reserveSlot('doc-1', date, '10:00', 'profile-own', {
          id: 'usr-1',
          role: UserRole.ADMIN,
        } as unknown as Parameters<SchedulesService['reserveSlot']>[4]),
      ).rejects.toThrow(
        new ApiException(
          'SCHEDULE.SLOT_LOCKED',
          'Slot is temporarily locked by another user',
          409,
        ),
      );
    });

    it('should delete existing reservation if same patient and create new reservation', async () => {
      bookingRepositoryMock.findSlotReservation.mockResolvedValue({
        id: 'res-1',
        patientProfileId: 'profile-own',
      });
      bookingRepositoryMock.createSlotReservation.mockResolvedValue({
        id: 'res-new',
      });

      const result = await service.reserveSlot(
        'doc-1',
        date,
        '10:00',
        'profile-own',
        { id: 'usr-1', role: UserRole.ADMIN } as unknown as Parameters<
          SchedulesService['reserveSlot']
        >[4],
      );

      expect(bookingRepositoryMock.deleteSlotReservation).toHaveBeenCalledWith(
        'res-1',
      );
      expect(bookingRepositoryMock.createSlotReservation).toHaveBeenCalled();
      expect(result).toEqual({ id: 'res-new' });
    });
  });

  describe('releaseSlot', () => {
    const user = { id: 'usr-1', role: UserRole.PATIENT };

    it('should throw forbidden if patient releases for another profile', async () => {
      userRepositoryMock.findByIdWithProfile.mockResolvedValue({
        patientProfile: { id: 'profile-own' },
      });

      await expect(
        service.releaseSlot(
          'doc-1',
          '2028-12-01',
          '09:00',
          'profile-other',
          user as unknown as Parameters<SchedulesService['releaseSlot']>[4],
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should delete reservation and invalidate slots cache', async () => {
      bookingRepositoryMock.deleteSlotReservationByDetails.mockResolvedValue({
        id: 'res-deleted',
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.releaseSlot(
        'doc-1',
        '2028-12-01',
        '09:00',
        'profile-own',
        { id: 'usr-1', role: UserRole.ADMIN } as unknown as Parameters<
          SchedulesService['releaseSlot']
        >[4],
      );

      expect(
        bookingRepositoryMock.deleteSlotReservationByDetails,
      ).toHaveBeenCalledWith(
        'doc-1',
        new Date('2028-12-01'),
        '09:00',
        'profile-own',
      );
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:2028-12-01:*',
      );
      expect(result).toEqual({ id: 'res-deleted' });
    });
  });

  describe('bulkUpdateWorkingHours', () => {
    const dto = {
      doctorId: 'doc-1',
      items: [
        {
          dayOfWeek: DayOfWeek.MONDAY,
          enabled: true,
          startTime: '08:00',
          endTime: '17:00',
          breakStartTime: '12:00',
          breakEndTime: '13:00',
        },
      ],
    };

    it('should throw ApiException if doctor not found or not DOCTOR', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);
      await expect(service.bulkUpdateWorkingHours(dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should validate times correctly', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });

      // startTime >= endTime
      await expect(
        service.bulkUpdateWorkingHours({
          doctorId: 'doc-1',
          items: [{ ...dto.items[0], startTime: '17:00', endTime: '08:00' }],
        }),
      ).rejects.toThrow(BadRequestException);

      // breakStartTime >= breakEndTime
      await expect(
        service.bulkUpdateWorkingHours({
          doctorId: 'doc-1',
          items: [
            { ...dto.items[0], breakStartTime: '13:00', breakEndTime: '12:00' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      // breakStartTime outside working hours
      await expect(
        service.bulkUpdateWorkingHours({
          doctorId: 'doc-1',
          items: [
            { ...dto.items[0], breakStartTime: '07:00', breakEndTime: '08:30' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should bulk update successfully', async () => {
      userRepositoryMock.findById.mockResolvedValue({
        id: 'doc-1',
        role: UserRole.DOCTOR,
      });
      bookingRepositoryMock.bulkUpdateDoctorWorkingHoursTransaction.mockResolvedValue(
        [{ id: 'wh-1' }],
      );

      const result = await service.bulkUpdateWorkingHours(dto);

      expect(
        bookingRepositoryMock.bulkUpdateDoctorWorkingHoursTransaction,
      ).toHaveBeenCalledWith('doc-1', dto.items);
      expect(result).toEqual([{ id: 'wh-1' }]);
    });
  });

  describe('getPendingOffDays', () => {
    it('should return pending off days list', async () => {
      bookingRepositoryMock.findPendingOffDaysWithDoctor.mockResolvedValue([
        { id: 'od-1' },
      ]);
      const result = await service.getPendingOffDays();
      expect(result).toEqual([{ id: 'od-1' }]);
    });
  });

  describe('approveOffDay', () => {
    it('should throw ApiException if off day not found', async () => {
      bookingRepositoryMock.findDoctorOffDayById.mockResolvedValue(null);
      await expect(service.approveOffDay('od-1', 'admin-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw BadRequestException if off day request is already processed', async () => {
      bookingRepositoryMock.findDoctorOffDayById.mockResolvedValue({
        status: OffDayStatus.APPROVED,
      });
      await expect(service.approveOffDay('od-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should cancel affected bookings, send emails, and approve off day request', async () => {
      bookingRepositoryMock.findDoctorOffDayById.mockResolvedValue({
        id: 'od-1',
        doctorId: 'doc-1',
        offDate: new Date('2028-12-01'),
        status: OffDayStatus.PENDING,
        reason: 'Vacation',
      });
      bookingRepositoryMock.findAffectedBookingsForDateRange.mockResolvedValue([
        {
          id: 'bk-1',
          bookingDate: new Date('2028-12-01'),
          startTime: '09:00',
          patientProfile: {
            userId: 'patient-1',
            fullName: 'Patient Name',
            email: 'patient@test.com',
          },
          doctor: { fullName: 'Dr. House' },
          service: { name: 'General Checkup', durationMinutes: 30 },
        },
      ]);
      bookingRepositoryMock.updateDoctorOffDay.mockResolvedValue({
        id: 'od-1',
        status: OffDayStatus.APPROVED,
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.approveOffDay('od-1', 'admin-1');

      expect(
        bookingRepositoryMock.updateBookingStatusTransaction,
      ).toHaveBeenCalledWith(
        'bk-1',
        BookingStatus.CANCELLED,
        'admin-1',
        expect.stringContaining('Bác sĩ nghỉ phép vào ngày 01/12/2028'),
      );
      expect(
        notificationsServiceMock.sendBookingCancellation,
      ).toHaveBeenCalled();
      expect(bookingRepositoryMock.updateDoctorOffDay).toHaveBeenCalledWith(
        'od-1',
        {
          status: OffDayStatus.APPROVED,
          approver: { connect: { id: 'admin-1' } },
        },
      );
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:slots:doc-1:2028-12-01:*',
      );
      expect(
        notificationsServiceMock.createInAppNotification,
      ).toHaveBeenCalled();
      expect(result.status).toBe(OffDayStatus.APPROVED);
    });
  });

  describe('rejectOffDay', () => {
    it('should throw ApiException if off day request not found', async () => {
      bookingRepositoryMock.findDoctorOffDayById.mockResolvedValue(null);
      await expect(service.rejectOffDay('od-1', 'admin-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw BadRequestException if off day request is already processed', async () => {
      bookingRepositoryMock.findDoctorOffDayById.mockResolvedValue({
        status: OffDayStatus.REJECTED,
      });
      await expect(service.rejectOffDay('od-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject off day request and send in-app notification', async () => {
      bookingRepositoryMock.findDoctorOffDayById.mockResolvedValue({
        id: 'od-1',
        doctorId: 'doc-1',
        offDate: new Date('2028-12-01'),
        status: OffDayStatus.PENDING,
      });
      bookingRepositoryMock.updateDoctorOffDay.mockResolvedValue({
        id: 'od-1',
        status: OffDayStatus.REJECTED,
      });

      const result = await service.rejectOffDay('od-1', 'admin-1');

      expect(bookingRepositoryMock.updateDoctorOffDay).toHaveBeenCalledWith(
        'od-1',
        {
          status: OffDayStatus.REJECTED,
          approver: { connect: { id: 'admin-1' } },
        },
      );
      expect(
        notificationsServiceMock.createInAppNotification,
      ).toHaveBeenCalledWith({
        userId: 'doc-1',
        title: 'Yêu cầu nghỉ phép bị từ chối',
        content: expect.stringContaining(
          'Yêu cầu nghỉ phép ngày 01/12/2028',
        ) as unknown as string,
        type: 'SYSTEM',
      });
      expect(result.status).toBe(OffDayStatus.REJECTED);
    });
  });
});
