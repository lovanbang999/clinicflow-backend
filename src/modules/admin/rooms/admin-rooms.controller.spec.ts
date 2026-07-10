import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FilterRoomDto } from './dto/filter-room.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { RoomType } from '@prisma/client';

describe('AdminRoomsController', () => {
  let controller: AdminRoomsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRoomsController],
      providers: [{ provide: AdminRoomsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminRoomsController>(AdminRoomsController);
  });

  describe('findAll', () => {
    it('should forward FilterRoomDto to service and return result', async () => {
      const filter: FilterRoomDto = {
        isActive: true,
        search: 'Exam Room',
      };
      const expectedResult = [{ id: 'room-1', name: 'Exam Room 1' }];
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filter);

      expect(serviceMock.findAll).toHaveBeenCalledWith(filter);
      expect(result).toBe(expectedResult);
    });
  });

  describe('create', () => {
    it('should forward CreateRoomDto to service and return result', async () => {
      const dto: CreateRoomDto = {
        name: 'Exam Room 3',
        type: RoomType.CONSULTATION,
        notes: 'General checkups',
      };
      const expectedResult = { id: 'room-3', ...dto };
      serviceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service', async () => {
      const dto: CreateRoomDto = {
        name: 'Exam Room 3',
        type: RoomType.CONSULTATION,
        notes: 'General checkups',
      };
      serviceMock.create.mockRejectedValue(
        new ConflictException('Room name exists'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should call findOne with id and return room', async () => {
      const roomId = 'room-uuid';
      const room = { id: roomId, name: 'Exam Room 1' };
      serviceMock.findOne.mockResolvedValue(room);

      const result = await controller.findOne(roomId);

      expect(serviceMock.findOne).toHaveBeenCalledWith(roomId);
      expect(result).toBe(room);
    });

    it('should propagate NotFoundException from service', async () => {
      const roomId = 'invalid-uuid';
      serviceMock.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(roomId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call update with id and DTO and return updated room', async () => {
      const roomId = 'room-uuid';
      const dto: UpdateRoomDto = { name: 'Updated Exam Room 1' };
      const expectedResult = { id: roomId, name: 'Updated Exam Room 1' };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.update(roomId, dto);

      expect(serviceMock.update).toHaveBeenCalledWith(roomId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from service during update', async () => {
      const roomId = 'invalid-uuid';
      const dto: UpdateRoomDto = { name: 'Updated Exam Room 1' };
      serviceMock.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(roomId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should call remove with id and return value', async () => {
      const roomId = 'room-uuid';
      const expectedResult = { id: roomId, isActive: false };
      serviceMock.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(roomId);

      expect(serviceMock.remove).toHaveBeenCalledWith(roomId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from service when room has active slots', async () => {
      const roomId = 'room-uuid';
      serviceMock.remove.mockRejectedValue(
        new BadRequestException('Room has active slots'),
      );

      await expect(controller.remove(roomId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('restore', () => {
    it('should call restore with id and return value', async () => {
      const roomId = 'room-uuid';
      const expectedResult = { id: roomId, isActive: true };
      serviceMock.restore.mockResolvedValue(expectedResult);

      const result = await controller.restore(roomId);

      expect(serviceMock.restore).toHaveBeenCalledWith(roomId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from restore endpoint', async () => {
      const roomId = 'invalid-uuid';
      serviceMock.restore.mockRejectedValue(new NotFoundException());

      await expect(controller.restore(roomId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
