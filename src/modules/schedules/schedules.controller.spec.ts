import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { BulkUpdateWorkingHoursDto } from './dto/bulk-update-working-hours.dto';
import { CreateBreakTimeDto } from './dto/create-break-time.dto';
import { CreateOffDayDto } from './dto/create-off-day.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { User, DayOfWeek } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('SchedulesController', () => {
  let controller: SchedulesController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      createWorkingHours: jest.fn(),
      getWorkingHours: jest.fn(),
      deleteWorkingHours: jest.fn(),
      createBreakTime: jest.fn(),
      getBreakTimes: jest.fn(),
      deleteBreakTime: jest.fn(),
      createOffDay: jest.fn(),
      previewOffDay: jest.fn(),
      getPendingOffDays: jest.fn(),
      approveOffDay: jest.fn(),
      rejectOffDay: jest.fn(),
      getOffDays: jest.fn(),
      deleteOffDay: jest.fn(),
      getAvailableSlots: jest.fn(),
      reserveSlot: jest.fn(),
      releaseSlot: jest.fn(),
      bulkUpdateWorkingHours: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [{ provide: SchedulesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<SchedulesController>(SchedulesController);
  });

  describe('createWorkingHours', () => {
    it('should forward DTO to service and return result', async () => {
      const dto: CreateWorkingHoursDto = {
        doctorId: 'doc-123',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '17:00',
      };
      const expectedResult = { id: 'wh-123', ...dto };
      serviceMock.createWorkingHours.mockResolvedValue(expectedResult);

      const result = await controller.createWorkingHours(dto);

      expect(serviceMock.createWorkingHours).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from service', async () => {
      const dto: CreateWorkingHoursDto = {
        doctorId: 'doc-123',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '18:00',
        endTime: '17:00',
      };
      serviceMock.createWorkingHours.mockRejectedValue(
        new BadRequestException('Invalid times'),
      );

      await expect(controller.createWorkingHours(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getWorkingHours', () => {
    it('should call getWorkingHours with doctorId and return result', async () => {
      const docId = 'doc-123';
      const expected = [
        { dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '17:00' },
      ];
      serviceMock.getWorkingHours.mockResolvedValue(expected);

      const result = await controller.getWorkingHours(docId);

      expect(serviceMock.getWorkingHours).toHaveBeenCalledWith(docId);
      expect(result).toBe(expected);
    });
  });

  describe('deleteWorkingHours', () => {
    it('should call deleteWorkingHours with doctorId and dayOfWeek and return result', async () => {
      const docId = 'doc-123';
      const day = DayOfWeek.MONDAY;
      const expected = { success: true };
      serviceMock.deleteWorkingHours.mockResolvedValue(expected);

      const result = await controller.deleteWorkingHours(docId, day);

      expect(serviceMock.deleteWorkingHours).toHaveBeenCalledWith(docId, day);
      expect(result).toBe(expected);
    });
  });

  describe('createBreakTime', () => {
    it('should forward CreateBreakTimeDto to service and return result', async () => {
      const dto: CreateBreakTimeDto = {
        doctorId: 'doc-123',
        date: '2026-07-20',
        startTime: '12:00',
        endTime: '13:00',
        reason: 'Lunch',
      };
      const expected = { id: 'bt-123', ...dto };
      serviceMock.createBreakTime.mockResolvedValue(expected);

      const result = await controller.createBreakTime(dto);

      expect(serviceMock.createBreakTime).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('getBreakTimes', () => {
    it('should call getBreakTimes with doctorId and dates', async () => {
      const docId = 'doc-123';
      const expected = [{ startTime: '12:00', endTime: '13:00' }];
      serviceMock.getBreakTimes.mockResolvedValue(expected);

      const result = await controller.getBreakTimes(
        docId,
        '2026-07-20',
        '2026-07-25',
      );

      expect(serviceMock.getBreakTimes).toHaveBeenCalledWith(
        docId,
        '2026-07-20',
        '2026-07-25',
      );
      expect(result).toBe(expected);
    });
  });

  describe('deleteBreakTime', () => {
    it('should call deleteBreakTime with id', async () => {
      const btId = 'bt-123';
      const expected = { success: true };
      serviceMock.deleteBreakTime.mockResolvedValue(expected);

      const result = await controller.deleteBreakTime(btId);

      expect(serviceMock.deleteBreakTime).toHaveBeenCalledWith(btId);
      expect(result).toBe(expected);
    });
  });

  describe('createOffDay', () => {
    it('should forward CreateOffDayDto to service', async () => {
      const dto: CreateOffDayDto = {
        doctorId: 'doc-123',
        date: '2026-07-20',
        reason: 'Medical Conference',
        cancelAffected: true,
      };
      const expected = { id: 'od-123', ...dto };
      serviceMock.createOffDay.mockResolvedValue(expected);

      const result = await controller.createOffDay(dto);

      expect(serviceMock.createOffDay).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('previewOffDay', () => {
    it('should call previewOffDay with doctorId and date', async () => {
      const docId = 'doc-123';
      const date = '2026-07-20';
      const expected = [{ id: 'booking-1' }];
      serviceMock.previewOffDay.mockResolvedValue(expected);

      const result = await controller.previewOffDay(docId, date);

      expect(serviceMock.previewOffDay).toHaveBeenCalledWith(docId, date);
      expect(result).toBe(expected);
    });
  });

  describe('getPendingOffDays', () => {
    it('should call getPendingOffDays on service', async () => {
      const expected = [{ id: 'od-123' }];
      serviceMock.getPendingOffDays.mockResolvedValue(expected);

      const result = await controller.getPendingOffDays();

      expect(serviceMock.getPendingOffDays).toHaveBeenCalled();
      expect(result).toBe(expected);
    });
  });

  describe('approveOffDay', () => {
    it('should call approveOffDay with id and user id', async () => {
      const mockUser = { id: 'admin-123' } as User;
      const expected = { id: 'od-123', status: 'APPROVED' };
      serviceMock.approveOffDay.mockResolvedValue(expected);

      const result = await controller.approveOffDay('od-123', mockUser);

      expect(serviceMock.approveOffDay).toHaveBeenCalledWith(
        'od-123',
        'admin-123',
      );
      expect(result).toBe(expected);
    });
  });

  describe('rejectOffDay', () => {
    it('should call rejectOffDay with id and user id', async () => {
      const mockUser = { id: 'admin-123' } as User;
      const expected = { id: 'od-123', status: 'REJECTED' };
      serviceMock.rejectOffDay.mockResolvedValue(expected);

      const result = await controller.rejectOffDay('od-123', mockUser);

      expect(serviceMock.rejectOffDay).toHaveBeenCalledWith(
        'od-123',
        'admin-123',
      );
      expect(result).toBe(expected);
    });
  });

  describe('getOffDays', () => {
    it('should call getOffDays with doctorId and dates', async () => {
      const docId = 'doc-123';
      const expected = [{ date: '2026-07-20' }];
      serviceMock.getOffDays.mockResolvedValue(expected);

      const result = await controller.getOffDays(
        docId,
        '2026-07-20',
        '2026-07-25',
      );

      expect(serviceMock.getOffDays).toHaveBeenCalledWith(
        docId,
        '2026-07-20',
        '2026-07-25',
      );
      expect(result).toBe(expected);
    });
  });

  describe('deleteOffDay', () => {
    it('should call deleteOffDay with doctorId and date', async () => {
      const docId = 'doc-123';
      const date = '2026-07-20';
      const expected = { success: true };
      serviceMock.deleteOffDay.mockResolvedValue(expected);

      const result = await controller.deleteOffDay(docId, date);

      expect(serviceMock.deleteOffDay).toHaveBeenCalledWith(docId, date);
      expect(result).toBe(expected);
    });
  });

  describe('getAvailableSlots', () => {
    it('should call getAvailableSlots with queryDto', async () => {
      const query: AvailableSlotsQueryDto = {
        doctorId: 'doc-123',
        date: '2026-07-20',
        serviceId: 'srv-123',
        patientId: 'patient-123',
      };
      const expected = { availableSlots: ['09:00'] };
      serviceMock.getAvailableSlots.mockResolvedValue(expected);

      const result = await controller.getAvailableSlots(query);

      expect(serviceMock.getAvailableSlots).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('reserveSlot', () => {
    it('should call reserveSlot with params and user', async () => {
      const mockUser = { id: 'patient-user-id' } as User;
      const body = {
        doctorId: 'doc-123',
        date: '2026-07-20',
        startTime: '09:00',
        patientProfileId: 'profile-123',
      };
      const expected = { success: true };
      serviceMock.reserveSlot.mockResolvedValue(expected);

      const result = await controller.reserveSlot(mockUser, body);

      expect(serviceMock.reserveSlot).toHaveBeenCalledWith(
        'doc-123',
        '2026-07-20',
        '09:00',
        'profile-123',
        mockUser,
      );
      expect(result).toBe(expected);
    });
  });

  describe('releaseSlot', () => {
    it('should call releaseSlot with params and user', async () => {
      const mockUser = { id: 'patient-user-id' } as User;
      const body = {
        doctorId: 'doc-123',
        date: '2026-07-20',
        startTime: '09:00',
        patientProfileId: 'profile-123',
      };
      const expected = { success: true };
      serviceMock.releaseSlot.mockResolvedValue(expected);

      const result = await controller.releaseSlot(mockUser, body);

      expect(serviceMock.releaseSlot).toHaveBeenCalledWith(
        'doc-123',
        '2026-07-20',
        '09:00',
        'profile-123',
        mockUser,
      );
      expect(result).toBe(expected);
    });
  });

  describe('bulkUpdateWorkingHours', () => {
    it('should call bulkUpdateWorkingHours with DTO', async () => {
      const dto: BulkUpdateWorkingHoursDto = {
        doctorId: 'doc-123',
        items: [
          {
            dayOfWeek: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '12:00',
            enabled: true,
          },
        ],
      };
      const expected = { success: true };
      serviceMock.bulkUpdateWorkingHours.mockResolvedValue(expected);

      const result = await controller.bulkUpdateWorkingHours(dto);

      expect(serviceMock.bulkUpdateWorkingHours).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });
});
