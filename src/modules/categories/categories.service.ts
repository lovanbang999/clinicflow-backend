import { Injectable, HttpStatus, Inject } from '@nestjs/common';
import {
  ICatalogRepository,
  I_CATALOG_REPOSITORY,
} from '../database/interfaces/catalog.repository.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { CategoryQueryDto } from './dto/category-query.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const existing = await this.catalogRepository.findCategoryByCode(
      createCategoryDto.code,
    );
    if (existing) {
      throw new ApiException(
        MessageCodes.CATEGORY_CODE_EXISTS,
        'Category code already exists',
        HttpStatus.CONFLICT,
      );
    }

    const category =
      await this.catalogRepository.createCategory(createCategoryDto);
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
    const { total, items } = await this.catalogRepository.findCategories(
      where,
      skip,
      limit,
    );

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
    const category = await this.catalogRepository.findCategoryById(id, true);
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
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) {
      throw new ApiException(
        MessageCodes.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (updateCategoryDto.code && updateCategoryDto.code !== category.code) {
      const existing = await this.catalogRepository.findCategoryByCode(
        updateCategoryDto.code,
      );
      if (existing) {
        throw new ApiException(
          MessageCodes.CATEGORY_CODE_EXISTS,
          'Category code already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    const updated = await this.catalogRepository.updateCategory(
      id,
      updateCategoryDto,
    );
    return ResponseHelper.success(
      updated,
      'CATEGORY_UPDATED',
      'Category updated successfully',
      200,
    );
  }

  async remove(id: string) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) {
      throw new ApiException(
        MessageCodes.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const serviceCount =
      await this.catalogRepository.countServicesByCategory(id);
    if (serviceCount > 0) {
      throw new ApiException(
        MessageCodes.CATEGORY_HAS_SERVICES,
        'Cannot delete category with associated services',
        HttpStatus.CONFLICT,
      );
    }

    await this.catalogRepository.deleteCategory(id);
    return ResponseHelper.success(
      null,
      'CATEGORY_DELETED',
      'Category deleted successfully',
      200,
    );
  }
}
