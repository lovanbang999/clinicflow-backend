import { Test, TestingModule } from '@nestjs/testing';
import { AdminSchedulesController } from './admin-schedules.controller';
import { AdminSchedulesService } from './admin-schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('AdminSchedulesController', () => {
  let controller: AdminSchedulesController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getStatistics: jest.fn(),
      getRooms: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSchedulesController],
      providers: [{ provide: AdminSchedulesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminSchedulesController>(AdminSchedulesController);
  });

  describe('getStatistics', () => {
    it('should call getStatistics on service and return value', async () => {
      const stats = { totalAppointments: 15 };
      serviceMock.getStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics();

      expect(serviceMock.getStatistics).toHaveBeenCalled();
      expect(result).toBe(stats);
    });
  });

  describe('getRooms', () => {
    it('should call getRooms on service and return list of active rooms', async () => {
      const rooms = [{ id: 'room-1', name: 'Room A' }];
      serviceMock.getRooms.mockResolvedValue(rooms);

      const result = await controller.getRooms();

      expect(serviceMock.getRooms).toHaveBeenCalled();
      expect(result).toBe(rooms);
    });
  });

  describe('create', () => {
    it('should forward DTO to service and return result', async () => {
      const dto: CreateScheduleDto = {
        doctorId: 'doc-uuid',
        roomId: 'room-uuid',
        date: '2026-07-20',
        startTime: '09:00',
        endTime: '12:00',
        maxPatients: 6,
      };
      const expectedResult = { id: 'sched-123', ...dto };
      serviceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service on overlap', async () => {
      const dto: CreateScheduleDto = {
        doctorId: 'doc-uuid',
        roomId: 'room-uuid',
        date: '2026-07-20',
        startTime: '09:00',
        endTime: '12:00',
        maxPatients: 6,
      };
      serviceMock.create.mockRejectedValue(
        new ConflictException('Slot overlaps'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should forward filterScheduleDto to service and return result', async () => {
      const filter: FilterScheduleDto = {
        doctorId: 'doc-uuid',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        isActive: true,
      };
      const expectedResult = [{ id: 'sched-123' }];
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filter);

      expect(serviceMock.findAll).toHaveBeenCalledWith(filter);
      expect(result).toBe(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should call findOne with id and return slot details', async () => {
      const schedId = 'sched-uuid';
      const slotDetail = { id: schedId, date: '2026-07-20' };
      serviceMock.findOne.mockResolvedValue(slotDetail);

      const result = await controller.findOne(schedId);

      expect(serviceMock.findOne).toHaveBeenCalledWith(schedId);
      expect(result).toBe(slotDetail);
    });

    it('should propagate NotFoundException from service', async () => {
      const schedId = 'invalid-uuid';
      serviceMock.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(schedId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call update with id and DTO and return updated slot', async () => {
      const schedId = 'sched-uuid';
      const dto: UpdateScheduleDto = { maxPatients: 10 };
      const expectedResult = { id: schedId, maxPatients: 10 };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.update(schedId, dto);

      expect(serviceMock.update).toHaveBeenCalledWith(schedId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from service on invalid update fields', async () => {
      const schedId = 'sched-uuid';
      const dto: UpdateScheduleDto = { startTime: '15:00', endTime: '14:00' };
      serviceMock.update.mockRejectedValue(
        new BadRequestException('Invalid times'),
      );

      await expect(controller.update(schedId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should call remove with id and return value', async () => {
      const schedId = 'sched-uuid';
      const expectedResult = { id: schedId, isActive: false };
      serviceMock.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(schedId);

      expect(serviceMock.remove).toHaveBeenCalledWith(schedId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from remove endpoint', async () => {
      const schedId = 'invalid-uuid';
      serviceMock.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(schedId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('should call restore with id and return value', async () => {
      const schedId = 'sched-uuid';
      const expectedResult = { id: schedId, isActive: true };
      serviceMock.restore.mockResolvedValue(expectedResult);

      const result = await controller.restore(schedId);

      expect(serviceMock.restore).toHaveBeenCalledWith(schedId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from restore endpoint', async () => {
      const schedId = 'invalid-uuid';
      serviceMock.restore.mockRejectedValue(new NotFoundException());

      await expect(controller.restore(schedId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
