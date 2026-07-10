import { Test, TestingModule } from '@nestjs/testing';
import { AdminServicesController } from './admin-services.controller';
import { AdminServicesService } from './admin-services.service';
import { AdminCreateServiceDto } from './dto/admin-create-service.dto';
import { AdminUpdateServiceDto } from './dto/admin-update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('AdminServicesController', () => {
  let controller: AdminServicesController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getServiceStatistics: jest.fn(),
      findAllServices: jest.fn(),
      findOneService: jest.fn(),
      createService: jest.fn(),
      updateService: jest.fn(),
      removeService: jest.fn(),
      restoreService: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminServicesController],
      providers: [{ provide: AdminServicesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminServicesController>(AdminServicesController);
  });

  describe('getServiceStatistics', () => {
    it('should call getServiceStatistics on service and return value', async () => {
      const stats = { totalServices: 5 };
      serviceMock.getServiceStatistics.mockResolvedValue(stats);

      const result = await controller.getServiceStatistics();

      expect(serviceMock.getServiceStatistics).toHaveBeenCalled();
      expect(result).toBe(stats);
    });
  });

  describe('getServices', () => {
    it('should forward filterDto to service and return result', async () => {
      const filterDto: FilterServiceDto = {
        isActive: true,
        search: 'Consultation',
      };
      const expectedResult = [{ id: 'srv-123', name: 'General Consultation' }];
      serviceMock.findAllServices.mockResolvedValue(expectedResult);

      const result = await controller.getServices(filterDto);

      expect(serviceMock.findAllServices).toHaveBeenCalledWith(filterDto);
      expect(result).toBe(expectedResult);
    });
  });

  describe('getServiceById', () => {
    it('should call findOneService with id and return value', async () => {
      const serviceId = 'srv-uuid';
      const serviceDetail = { id: serviceId, name: 'General Consultation' };
      serviceMock.findOneService.mockResolvedValue(serviceDetail);

      const result = await controller.getServiceById(serviceId);

      expect(serviceMock.findOneService).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(serviceDetail);
    });

    it('should propagate NotFoundException from service', async () => {
      const serviceId = 'invalid-uuid';
      serviceMock.findOneService.mockRejectedValue(new NotFoundException());

      await expect(controller.getServiceById(serviceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createService', () => {
    it('should forward dto to service and return created service', async () => {
      const dto: AdminCreateServiceDto = {
        name: 'Eye Exam',
        description: 'Comprehensive vision test',
        durationMinutes: 30,
        price: 150,
        categoryId: 'cat-123',
        maxSlotsPerHour: 3,
      };
      const expectedResult = { id: 'srv-123', ...dto };
      serviceMock.createService.mockResolvedValue(expectedResult);

      const result = await controller.createService(dto);

      expect(serviceMock.createService).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service on duplicate name', async () => {
      const dto: AdminCreateServiceDto = {
        name: 'Eye Exam',
        description: 'Comprehensive vision test',
        durationMinutes: 30,
        price: 150,
        categoryId: 'cat-123',
        maxSlotsPerHour: 3,
      };
      serviceMock.createService.mockRejectedValue(
        new ConflictException('Service name exists'),
      );

      await expect(controller.createService(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateService', () => {
    it('should forward id and dto to service and return updated service', async () => {
      const serviceId = 'srv-uuid';
      const dto: AdminUpdateServiceDto = {
        name: 'Advanced Eye Exam',
        price: 200,
      };
      const expectedResult = { id: serviceId, ...dto };
      serviceMock.updateService.mockResolvedValue(expectedResult);

      const result = await controller.updateService(serviceId, dto);

      expect(serviceMock.updateService).toHaveBeenCalledWith(serviceId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from service during update', async () => {
      const serviceId = 'invalid-uuid';
      const dto: AdminUpdateServiceDto = { name: 'Advanced Eye Exam' };
      serviceMock.updateService.mockRejectedValue(new NotFoundException());

      await expect(controller.updateService(serviceId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteService', () => {
    it('should call removeService with id and return value', async () => {
      const serviceId = 'srv-uuid';
      const expectedResult = { id: serviceId, isActive: false };
      serviceMock.removeService.mockResolvedValue(expectedResult);

      const result = await controller.deleteService(serviceId);

      expect(serviceMock.removeService).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from service when service has active bookings', async () => {
      const serviceId = 'srv-uuid';
      serviceMock.removeService.mockRejectedValue(
        new BadRequestException('Has active bookings'),
      );

      await expect(controller.deleteService(serviceId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('restoreService', () => {
    it('should call restoreService with id and return value', async () => {
      const serviceId = 'srv-uuid';
      const expectedResult = { id: serviceId, isActive: true };
      serviceMock.restoreService.mockResolvedValue(expectedResult);

      const result = await controller.restoreService(serviceId);

      expect(serviceMock.restoreService).toHaveBeenCalledWith(serviceId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from restoreService', async () => {
      const serviceId = 'invalid-uuid';
      serviceMock.restoreService.mockRejectedValue(new NotFoundException());

      await expect(controller.restoreService(serviceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
