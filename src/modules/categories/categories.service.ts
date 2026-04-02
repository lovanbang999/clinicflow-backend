import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';

import { CategoryQueryDto } from './dto/category-query.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { code: createCategoryDto.code },
    });
    if (existing) {
      throw new ApiException(
        MessageCodes.CATEGORY_CODE_EXISTS,
        'Category code already exists',
        HttpStatus.CONFLICT,
      );
    }

    const category = await this.prisma.category.create({
      data: createCategoryDto,
    });
    return ResponseHelper.success(
      category,
      'CATEGORY_CREATED',
      'Category created successfully',
      201,
    );
  }

  async findAll(query: CategoryQueryDto) {
    const { isActive, page = 1, limit = 10 } = query;
    const where = isActive !== undefined ? { isActive } : {};

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return ResponseHelper.successPagination(
      items,
      total,
      page,
      limit,
      'CATEGORIES_RETRIEVED',
      'Categories retrieved',
      200,
    );
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { services: true } },
      },
    });
    if (!category) {
      throw new ApiException(
        MessageCodes.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return ResponseHelper.success(
      category,
      'CATEGORY_RETRIEVED',
      'Category retrieved',
      200,
    );
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new ApiException(
        MessageCodes.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (updateCategoryDto.code && updateCategoryDto.code !== category.code) {
      const existing = await this.prisma.category.findUnique({
        where: { code: updateCategoryDto.code },
      });
      if (existing) {
        throw new ApiException(
          MessageCodes.CATEGORY_CODE_EXISTS,
          'Category code already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
    return ResponseHelper.success(
      updated,
      'CATEGORY_UPDATED',
      'Category updated successfully',
      200,
    );
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new ApiException(
        MessageCodes.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const serviceCount = await this.prisma.service.count({
      where: { categoryId: id },
    });
    if (serviceCount > 0) {
      throw new ApiException(
        MessageCodes.CATEGORY_HAS_SERVICES,
        'Cannot delete category with associated services',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return ResponseHelper.success(
      null,
      'CATEGORY_DELETED',
      'Category deleted successfully',
      200,
    );
  }
}
