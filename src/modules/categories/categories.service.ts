import { Injectable, HttpStatus, Inject } from '@nestjs/common';
import {
  ICatalogRepository,
  I_CATALOG_REPOSITORY,
} from '../database/interfaces/catalog.repository.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { CategoryQueryDto } from './dto/category-query.dto';
import { RedisService } from '../database/services/redis.service';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    private readonly redisService: RedisService,
  ) {}

  private async clearCategoriesCache() {
    if (this.redisService.isReady()) {
      await this.redisService.delPattern('cache:categories:list:*');
    }
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
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

    // Evict cache
    await this.clearCategoriesCache();

    return category;
  }

  async findAll(query: CategoryQueryDto): Promise<{
    items: Category[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { isActive, page = 1, limit = 10 } = query;
    const cacheKey = `cache:categories:list:${JSON.stringify(query)}`;

    // Try to get from Redis cache first
    if (this.redisService.isReady()) {
      const cached = await this.redisService.getJson<{
        items: Category[];
        total: number;
      }>(cacheKey);
      if (cached) {
        return {
          items: cached.items,
          total: cached.total,
          page,
          limit,
        };
      }
    }

    const where = isActive !== undefined ? { isActive } : {};
    const skip = (page - 1) * limit;
    const { total, items } = await this.catalogRepository.findCategories(
      where,
      skip,
      limit,
    );

    // Save to Redis cache (TTL: 12 hours = 43200 seconds)
    if (this.redisService.isReady()) {
      await this.redisService.setJson(cacheKey, { items, total }, 43200);
    }

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.catalogRepository.findCategoryById(id, true);
    if (!category) {
      throw new ApiException(
        MessageCodes.CATEGORY_NOT_FOUND,
        'Category not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
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

    // Evict cache
    await this.clearCategoriesCache();

    return updated;
  }

  async remove(id: string): Promise<null> {
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

    // Evict cache
    await this.clearCategoriesCache();

    return null;
  }
}
