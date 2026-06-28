import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import {
  I_CLINICAL_REPOSITORY,
  IClinicalRepository,
} from '../../database/interfaces/clinical.repository.interface';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../common/exceptions/api.exception';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { AdminCreateMedicineDto } from './dto/admin-create-medicine.dto';
import { AdminUpdateMedicineDto } from './dto/admin-update-medicine.dto';
import { FilterMedicineDto } from './dto/filter-medicine.dto';

@Injectable()
export class AdminMedicinesService {
  constructor(
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
  ) {}

  /**
   * GET /admin/medicines/statistics
   */
  async getMedicineStatistics() {
    const [totalMedicines, activeMedicines, outOfStockMedicines] =
      await Promise.all([
        this.clinicalRepository.countMedicine({}),
        this.clinicalRepository.countMedicine({ where: { isActive: true } }),
        this.clinicalRepository.countMedicine({ where: { stockQuantity: 0 } }),
      ]);

    return {
      totalMedicines,
      activeMedicines,
      inactiveMedicines: totalMedicines - activeMedicines,
      outOfStockMedicines,
    };
  }

  /**
   * GET /admin/medicines
   * List all medicines with optional search / isActive filter.
   */
  async findAllMedicines(filterDto: FilterMedicineDto) {
    const { isActive, search, page = 1, limit = 10 } = filterDto;
    const where: Prisma.MedicineWhereInput = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { genericName: { contains: search } },
        { brandName: { contains: search } },
        { code: { contains: search } },
        { notes: { contains: search } },
        { ingredients: { contains: search } },
      ];
    }

    const [medicines, total] = await Promise.all([
      this.clinicalRepository.findManyMedicine({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.clinicalRepository.countMedicine({ where }),
    ]);

    return {
      medicines,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/medicines/:id
   */
  async findOneMedicine(id: string) {
    const medicine = await this.clinicalRepository.findUniqueMedicine({
      where: { id },
    });
    if (!medicine) {
      throw new ApiException(
        MessageCodes.MEDICINE_NOT_FOUND,
        'Medicine not found',
        404,
        'Medicine retrieval failed',
      );
    }
    return medicine;
  }

  /**
   * POST /admin/medicines
   */
  async createMedicine(dto: AdminCreateMedicineDto) {
    // Check if code already exists
    const existing = await this.clinicalRepository.findManyMedicine({
      where: { code: dto.code },
      take: 1,
    });
    if (existing.length > 0) {
      throw new ApiException(
        MessageCodes.MEDICINE_CODE_EXISTS,
        'Medicine with this code already exists',
        409,
        'Medicine creation failed',
      );
    }

    const medicine = await this.clinicalRepository.createMedicine({
      data: {
        code: dto.code,
        genericName: dto.genericName,
        brandName: dto.brandName,
        concentration: dto.concentration,
        dosageForm: dto.dosageForm,
        defaultUnit: dto.defaultUnit ?? 'viên',
        defaultPrice: new Prisma.Decimal(dto.defaultPrice),
        isActive: dto.isActive ?? true,
        stockQuantity: dto.stockQuantity ?? 0,
        notes: dto.notes,
        registrationNumber: dto.registrationNumber,
        ingredients: dto.ingredients,
        sideEffects: dto.sideEffects,
        warnings: dto.warnings,
        manufacturerBrand: dto.manufacturerBrand,
        country: dto.country,
        imageUrl: dto.imageUrl,
        usage: dto.usage,
        uses: dto.uses,
      },
    });

    return medicine;
  }

  /**
   * PATCH /admin/medicines/:id
   */
  async updateMedicine(id: string, dto: AdminUpdateMedicineDto) {
    const medicine = await this.clinicalRepository.findUniqueMedicine({
      where: { id },
    });
    if (!medicine) {
      throw new ApiException(
        MessageCodes.MEDICINE_NOT_FOUND,
        'Medicine not found',
        404,
        'Medicine update failed',
      );
    }

    if (dto.code) {
      const existing = await this.clinicalRepository.findManyMedicine({
        where: { code: dto.code, id: { not: id } },
        take: 1,
      });
      if (existing.length > 0) {
        throw new ApiException(
          MessageCodes.MEDICINE_CODE_EXISTS,
          'Medicine with this code already exists',
          409,
          'Medicine update failed',
        );
      }
    }

    const updated = await this.clinicalRepository.updateMedicine({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.genericName !== undefined && { genericName: dto.genericName }),
        ...(dto.brandName !== undefined && { brandName: dto.brandName }),
        ...(dto.concentration !== undefined && {
          concentration: dto.concentration,
        }),
        ...(dto.dosageForm !== undefined && { dosageForm: dto.dosageForm }),
        ...(dto.defaultUnit !== undefined && { defaultUnit: dto.defaultUnit }),
        ...(dto.defaultPrice !== undefined && {
          defaultPrice: new Prisma.Decimal(dto.defaultPrice),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.stockQuantity !== undefined && {
          stockQuantity: dto.stockQuantity,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.registrationNumber !== undefined && {
          registrationNumber: dto.registrationNumber,
        }),
        ...(dto.ingredients !== undefined && { ingredients: dto.ingredients }),
        ...(dto.sideEffects !== undefined && { sideEffects: dto.sideEffects }),
        ...(dto.warnings !== undefined && { warnings: dto.warnings }),
        ...(dto.manufacturerBrand !== undefined && {
          manufacturerBrand: dto.manufacturerBrand,
        }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.usage !== undefined && { usage: dto.usage }),
        ...(dto.uses !== undefined && { uses: dto.uses }),
      },
    });

    return updated;
  }

  /**
   * DELETE /admin/medicines/:id
   * Soft-delete setting isActive = false.
   */
  async removeMedicine(id: string) {
    const medicine = await this.clinicalRepository.findUniqueMedicine({
      where: { id },
    });
    if (!medicine) {
      throw new ApiException(
        MessageCodes.MEDICINE_NOT_FOUND,
        'Medicine not found',
        404,
        'Medicine deactivation failed',
      );
    }

    const deactivated = await this.clinicalRepository.updateMedicine({
      where: { id },
      data: { isActive: false },
    });

    return deactivated;
  }

  /**
   * PATCH /admin/medicines/:id/restore
   */
  async restoreMedicine(id: string) {
    const medicine = await this.clinicalRepository.findUniqueMedicine({
      where: { id },
    });
    if (!medicine) {
      throw new ApiException(
        MessageCodes.MEDICINE_NOT_FOUND,
        'Medicine not found',
        404,
        'Medicine activation failed',
      );
    }

    if (medicine.isActive) {
      throw new BadRequestException('Medicine is already active');
    }

    const restored = await this.clinicalRepository.updateMedicine({
      where: { id },
      data: { isActive: true },
    });

    return restored;
  }
}
