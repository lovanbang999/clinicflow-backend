import { Test, TestingModule } from '@nestjs/testing';
import { AdminMedicinesController } from './admin-medicines.controller';
import { AdminMedicinesService } from './admin-medicines.service';
import { AdminCreateMedicineDto } from './dto/admin-create-medicine.dto';
import { AdminUpdateMedicineDto } from './dto/admin-update-medicine.dto';
import { FilterMedicineDto } from './dto/filter-medicine.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('AdminMedicinesController', () => {
  let controller: AdminMedicinesController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getMedicineStatistics: jest.fn(),
      findAllMedicines: jest.fn(),
      findOneMedicine: jest.fn(),
      createMedicine: jest.fn(),
      updateMedicine: jest.fn(),
      removeMedicine: jest.fn(),
      restoreMedicine: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMedicinesController],
      providers: [{ provide: AdminMedicinesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminMedicinesController>(AdminMedicinesController);
  });

  describe('getMedicineStatistics', () => {
    it('should call getMedicineStatistics on service and return value', async () => {
      const stats = { totalMedicines: 50 };
      serviceMock.getMedicineStatistics.mockResolvedValue(stats);

      const result = await controller.getMedicineStatistics();

      expect(serviceMock.getMedicineStatistics).toHaveBeenCalled();
      expect(result).toBe(stats);
    });
  });

  describe('getMedicines', () => {
    it('should forward filterDto to service and return result', async () => {
      const filter: FilterMedicineDto = {
        isActive: true,
        search: 'Paracetamol',
        page: 1,
        limit: 20,
      };
      const expectedResult = { medicines: [], total: 0 };
      serviceMock.findAllMedicines.mockResolvedValue(expectedResult);

      const result = await controller.getMedicines(filter);

      expect(serviceMock.findAllMedicines).toHaveBeenCalledWith(filter);
      expect(result).toBe(expectedResult);
    });
  });

  describe('getMedicineById', () => {
    it('should call findOneMedicine with id and return value', async () => {
      const medId = 'med-uuid';
      const medicineDetail = { id: medId, name: 'Paracetamol 500mg' };
      serviceMock.findOneMedicine.mockResolvedValue(medicineDetail);

      const result = await controller.getMedicineById(medId);

      expect(serviceMock.findOneMedicine).toHaveBeenCalledWith(medId);
      expect(result).toBe(medicineDetail);
    });

    it('should propagate NotFoundException from service', async () => {
      const medId = 'invalid-uuid';
      serviceMock.findOneMedicine.mockRejectedValue(new NotFoundException());

      await expect(controller.getMedicineById(medId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createMedicine', () => {
    it('should forward DTO to service and return result', async () => {
      const dto: AdminCreateMedicineDto = {
        code: 'MED-001',
        genericName: 'Paracetamol',
        brandName: 'Panadol Extra',
        dosageForm: 'Tablet',
        defaultUnit: 'Box',
        defaultPrice: 5.5,
        stockQuantity: 1000,
        notes: 'Pain reliever',
      };
      const expectedResult = { id: 'med-123', ...dto };
      serviceMock.createMedicine.mockResolvedValue(expectedResult);

      const result = await controller.createMedicine(dto);

      expect(serviceMock.createMedicine).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service on duplicate code', async () => {
      const dto: AdminCreateMedicineDto = {
        code: 'MED-001',
        genericName: 'Paracetamol',
        brandName: 'Panadol Extra',
        dosageForm: 'Tablet',
        defaultUnit: 'Box',
        defaultPrice: 5.5,
        stockQuantity: 1000,
        notes: 'Pain reliever',
      };
      serviceMock.createMedicine.mockRejectedValue(
        new ConflictException('Code already exists'),
      );

      await expect(controller.createMedicine(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateMedicine', () => {
    it('should call updateMedicine with id and DTO and return result', async () => {
      const medId = 'med-uuid';
      const dto: AdminUpdateMedicineDto = { stockQuantity: 1200 };
      const expectedResult = { id: medId, stockQuantity: 1200 };
      serviceMock.updateMedicine.mockResolvedValue(expectedResult);

      const result = await controller.updateMedicine(medId, dto);

      expect(serviceMock.updateMedicine).toHaveBeenCalledWith(medId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from service during update', async () => {
      const medId = 'invalid-uuid';
      const dto: AdminUpdateMedicineDto = { stockQuantity: 1200 };
      serviceMock.updateMedicine.mockRejectedValue(new NotFoundException());

      await expect(controller.updateMedicine(medId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteMedicine', () => {
    it('should call removeMedicine with id and return value', async () => {
      const medId = 'med-uuid';
      const expectedResult = { id: medId, isActive: false };
      serviceMock.removeMedicine.mockResolvedValue(expectedResult);

      const result = await controller.deleteMedicine(medId);

      expect(serviceMock.removeMedicine).toHaveBeenCalledWith(medId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from delete endpoint', async () => {
      const medId = 'invalid-uuid';
      serviceMock.removeMedicine.mockRejectedValue(new NotFoundException());

      await expect(controller.deleteMedicine(medId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('restoreMedicine', () => {
    it('should call restoreMedicine with id and return value', async () => {
      const medId = 'med-uuid';
      const expectedResult = { id: medId, isActive: true };
      serviceMock.restoreMedicine.mockResolvedValue(expectedResult);

      const result = await controller.restoreMedicine(medId);

      expect(serviceMock.restoreMedicine).toHaveBeenCalledWith(medId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from restore endpoint on active medicine', async () => {
      const medId = 'med-uuid';
      serviceMock.restoreMedicine.mockRejectedValue(
        new BadRequestException('Already active'),
      );

      await expect(controller.restoreMedicine(medId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
