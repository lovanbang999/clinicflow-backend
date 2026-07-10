import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('ServicesController', () => {
  let controller: ServicesController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getStatistics: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: ServicesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<ServicesController>(ServicesController);
  });

  describe('create', () => {
    it('should forward CreateServiceDto to service and return result', async () => {
      const dto: CreateServiceDto = {
        name: 'General Consultation',
        description: 'Routine checkup',
        durationMinutes: 30,
        price: 150000,
        maxSlotsPerHour: 4,
        categoryId: 'cat-123',
      };
      const expectedResult = { id: 'srv-123', ...dto };
      serviceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service', async () => {
      const dto: CreateServiceDto = {
        name: 'General Consultation',
        description: 'Routine checkup',
        durationMinutes: 30,
        price: 150000,
        maxSlotsPerHour: 4,
        categoryId: 'cat-123',
      };
      serviceMock.create.mockRejectedValue(
        new ConflictException('Service exists'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should build filter object correctly and call service.findAll', async () => {
      const expectedResult = [{ id: 'srv-123', name: 'General Consultation' }];
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(
        'true',
        'Consultation',
        'EXAMINATION',
        'DOCTOR',
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith({
        isActive: true,
        search: 'Consultation',
        categoryType: 'EXAMINATION',
        performedBy: 'DOCTOR',
      });
      expect(result).toBe(expectedResult);
    });

    it('should handle undefined parameters and build clean filter object', async () => {
      const expectedResult = [{ id: 'srv-123', name: 'General Consultation' }];
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(
        undefined,
        undefined,
        undefined,
        'INVALID_PERFORMED_BY',
      );

      expect(serviceMock.findAll).toHaveBeenCalledWith({});
      expect(result).toBe(expectedResult);
    });

    it('should build isActive as false when string is not true', async () => {
      serviceMock.findAll.mockResolvedValue([]);
      await controller.findAll('false');
      expect(serviceMock.findAll).toHaveBeenCalledWith({ isActive: false });
    });
  });

  describe('findOne', () => {
    it('should call findOne with id and return service details', async () => {
      const serviceId = 'srv-uuid';
      const serviceDetail = { id: serviceId, name: 'General Consultation' };
      serviceMock.findOne.mockResolvedValue(serviceDetail);

      const result = await controller.findOne(serviceId);

      expect(serviceMock.findOne).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(serviceDetail);
    });

    it('should propagate NotFoundException from service', async () => {
      const serviceId = 'invalid-uuid';
      serviceMock.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(serviceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatistics', () => {
    it('should call getStatistics with id and return service stats', async () => {
      const serviceId = 'srv-uuid';
      const stats = { totalBookings: 100 };
      serviceMock.getStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics(serviceId);

      expect(serviceMock.getStatistics).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(stats);
    });
  });

  describe('update', () => {
    it('should call update with id and DTO and return result', async () => {
      const serviceId = 'srv-uuid';
      const dto: UpdateServiceDto = { name: 'Updated Consultation' };
      const expectedResult = { id: serviceId, name: 'Updated Consultation' };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.update(serviceId, dto);

      expect(serviceMock.update).toHaveBeenCalledWith(serviceId, dto);
      expect(result).toBe(expectedResult);
    });
  });

  describe('remove', () => {
    it('should call remove with id and return value', async () => {
      const serviceId = 'srv-uuid';
      const expectedResult = { id: serviceId, isActive: false };
      serviceMock.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(serviceId);

      expect(serviceMock.remove).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from remove endpoint', async () => {
      const serviceId = 'srv-uuid';
      serviceMock.remove.mockRejectedValue(
        new BadRequestException('Cannot delete'),
      );

      await expect(controller.remove(serviceId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('restore', () => {
    it('should call restore with id and return value', async () => {
      const serviceId = 'srv-uuid';
      const expectedResult = { id: serviceId, isActive: true };
      serviceMock.restore.mockResolvedValue(expectedResult);

      const result = await controller.restore(serviceId);

      expect(serviceMock.restore).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(expectedResult);
    });
  });
});
