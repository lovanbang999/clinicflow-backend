import { Test, TestingModule } from '@nestjs/testing';
import { AdminMedicinesService } from './admin-medicines.service';
import { I_CLINICAL_REPOSITORY } from '../../database/interfaces/clinical.repository.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { BadRequestException } from '@nestjs/common';

describe('AdminMedicinesService', () => {
  let service: AdminMedicinesService;
  let clinicalRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    clinicalRepositoryMock = {
      getMedicineStatistics: jest.fn(),
      findMedicinesWithPagination: jest.fn(),
      findMedicineDetail: jest.fn(),
      findMedicineByCode: jest.fn(),
      createMedicinePlain: jest.fn(),
      updateMedicineById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminMedicinesService,
        { provide: I_CLINICAL_REPOSITORY, useValue: clinicalRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminMedicinesService>(AdminMedicinesService);
  });

  describe('getMedicineStatistics', () => {
    it('should return statistics mapped correctly', async () => {
      clinicalRepositoryMock.getMedicineStatistics.mockResolvedValue({
        totalMedicines: 50,
        activeMedicines: 45,
        outOfStockMedicines: 5,
      });

      const stats = await service.getMedicineStatistics();

      expect(clinicalRepositoryMock.getMedicineStatistics).toHaveBeenCalled();
      expect(stats.totalMedicines).toBe(50);
      expect(stats.activeMedicines).toBe(45);
      expect(stats.inactiveMedicines).toBe(5);
      expect(stats.outOfStockMedicines).toBe(5);
    });
  });

  describe('findAllMedicines', () => {
    it('should query ClinicalRepository findMedicinesWithPagination', async () => {
      clinicalRepositoryMock.findMedicinesWithPagination.mockResolvedValue([
        [{ id: 'med-1', brandName: 'Paracetamol' }],
        1,
      ]);

      const result = await service.findAllMedicines({
        isActive: true,
        search: 'Para',
      });

      expect(
        clinicalRepositoryMock.findMedicinesWithPagination,
      ).toHaveBeenCalled();
      expect(result.medicines.length).toBe(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('findOneMedicine', () => {
    it('should return medicine detail if exists', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue({
        id: 'med-1',
        brandName: 'Paracetamol',
      });

      const result = await service.findOneMedicine('med-1');

      expect(clinicalRepositoryMock.findMedicineDetail).toHaveBeenCalledWith(
        'med-1',
      );
      expect(result.brandName).toBe('Paracetamol');
    });

    it('should throw MEDICINE_NOT_FOUND if medicine not found', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue(null);

      await expect(service.findOneMedicine('med-1')).rejects.toThrow(
        ApiException,
      );
    });
  });

  describe('createMedicine', () => {
    const dto = {
      code: 'MED001',
      genericName: 'Paracetamol',
      brandName: 'Panadol',
      concentration: '500mg',
      dosageForm: 'tablet',
      defaultUnit: 'viên',
      defaultPrice: 1000,
      stockQuantity: 100,
      notes: 'Take after meal',
    };

    it('should throw MEDICINE_CODE_EXISTS if medicine code exists', async () => {
      clinicalRepositoryMock.findMedicineByCode.mockResolvedValue({
        id: 'med-existing',
      });

      await expect(service.createMedicine(dto)).rejects.toThrow(ApiException);
    });

    it('should create medicine successfully if code is unique', async () => {
      clinicalRepositoryMock.findMedicineByCode.mockResolvedValue(null);
      clinicalRepositoryMock.createMedicinePlain.mockResolvedValue({
        id: 'med-1',
        brandName: dto.brandName,
      });

      const result = await service.createMedicine(dto);

      expect(clinicalRepositoryMock.createMedicinePlain).toHaveBeenCalled();
      expect(result.brandName).toBe(dto.brandName);
    });
  });

  describe('updateMedicine', () => {
    const dto = {
      code: 'MED002',
      brandName: 'Panadol Extra',
    };

    it('should throw MEDICINE_NOT_FOUND if medicine not found', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue(null);

      await expect(service.updateMedicine('med-1', dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw MEDICINE_CODE_EXISTS if updated code already exists on another medicine', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue({
        id: 'med-1',
      });
      clinicalRepositoryMock.findMedicineByCode.mockResolvedValue({
        id: 'med-other',
      });

      await expect(service.updateMedicine('med-1', dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should update medicine successfully', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue({
        id: 'med-1',
      });
      clinicalRepositoryMock.findMedicineByCode.mockResolvedValue(null);
      clinicalRepositoryMock.updateMedicineById.mockResolvedValue({
        id: 'med-1',
        brandName: dto.brandName,
      });

      const result = await service.updateMedicine('med-1', dto);

      expect(clinicalRepositoryMock.updateMedicineById).toHaveBeenCalled();
      expect(result.brandName).toBe(dto.brandName);
    });
  });

  describe('removeMedicine', () => {
    it('should throw MEDICINE_NOT_FOUND if medicine not found', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue(null);

      await expect(service.removeMedicine('med-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should deactivate medicine by setting isActive to false', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue({
        id: 'med-1',
      });
      clinicalRepositoryMock.updateMedicineById.mockResolvedValue({
        id: 'med-1',
        isActive: false,
      });

      const result = await service.removeMedicine('med-1');

      expect(clinicalRepositoryMock.updateMedicineById).toHaveBeenCalledWith(
        'med-1',
        { isActive: false },
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('restoreMedicine', () => {
    it('should throw MEDICINE_NOT_FOUND if medicine not found', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue(null);

      await expect(service.restoreMedicine('med-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw BadRequestException if medicine is already active', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue({
        id: 'med-1',
        isActive: true,
      });

      await expect(service.restoreMedicine('med-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should activate medicine by setting isActive to true', async () => {
      clinicalRepositoryMock.findMedicineDetail.mockResolvedValue({
        id: 'med-1',
        isActive: false,
      });
      clinicalRepositoryMock.updateMedicineById.mockResolvedValue({
        id: 'med-1',
        isActive: true,
      });

      const result = await service.restoreMedicine('med-1');

      expect(clinicalRepositoryMock.updateMedicineById).toHaveBeenCalledWith(
        'med-1',
        { isActive: true },
      );
      expect(result.isActive).toBe(true);
    });
  });
});
