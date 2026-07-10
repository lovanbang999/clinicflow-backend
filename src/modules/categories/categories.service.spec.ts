import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { I_CATALOG_REPOSITORY } from '../database/interfaces/catalog.repository.interface';
import { RedisService } from '../database/services/redis.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { HttpStatus } from '@nestjs/common';
import { MessageCodes } from '../../common/constants/message-codes.const';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let catalogRepositoryMock: Record<string, jest.Mock>;
  let redisServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    catalogRepositoryMock = {
      findCategoryByCode: jest.fn(),
      createCategory: jest.fn(),
      findCategories: jest.fn(),
      findCategoryById: jest.fn(),
      updateCategory: jest.fn(),
      countServicesByCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };

    redisServiceMock = {
      isReady: jest.fn().mockReturnValue(false),
      delPattern: jest.fn(),
      getJson: jest.fn(),
      setJson: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('create', () => {
    const dto = { name: 'Lab Tests', code: 'LAB_TEST', isActive: true };

    it('should throw ApiException if category code already exists', async () => {
      catalogRepositoryMock.findCategoryByCode.mockResolvedValue({
        id: 'cat-1',
      });

      await expect(service.create(dto)).rejects.toThrow(
        new ApiException(
          MessageCodes.CATEGORY_CODE_EXISTS,
          'Category code already exists',
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should create category and evict cache', async () => {
      catalogRepositoryMock.findCategoryByCode.mockResolvedValue(null);
      catalogRepositoryMock.createCategory.mockResolvedValue({
        id: 'cat-new',
        ...dto,
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.create(dto);

      expect(catalogRepositoryMock.createCategory).toHaveBeenCalledWith(dto);
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:categories:list:*',
      );
      expect(result).toEqual({ id: 'cat-new', ...dto });
    });
  });

  describe('findAll', () => {
    const query = { isActive: true, page: 1, limit: 10 };
    const mockResult = {
      items: [{ id: 'cat-1', name: 'Lab' }],
      total: 1,
    };

    it('should return cached result if cache hit', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      redisServiceMock.getJson.mockResolvedValue(mockResult);

      const result = await service.findAll(query);

      expect(redisServiceMock.getJson).toHaveBeenCalledWith(
        `cache:categories:list:${JSON.stringify(query)}`,
      );
      expect(catalogRepositoryMock.findCategories).not.toHaveBeenCalled();
      expect(result).toEqual({
        items: mockResult.items,
        total: mockResult.total,
        page: 1,
        limit: 10,
      });
    });

    it('should query catalogRepository and cache result on cache miss', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      redisServiceMock.getJson.mockResolvedValue(null);
      catalogRepositoryMock.findCategories.mockResolvedValue(mockResult);

      const result = await service.findAll(query);

      expect(catalogRepositoryMock.findCategories).toHaveBeenCalledWith(
        { isActive: true },
        0,
        10,
      );
      expect(redisServiceMock.setJson).toHaveBeenCalledWith(
        `cache:categories:list:${JSON.stringify(query)}`,
        mockResult,
        43200,
      );
      expect(result).toEqual({
        items: mockResult.items,
        total: mockResult.total,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return category detail if exists', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({ id: 'cat-1' });

      const result = await service.findOne('cat-1');

      expect(catalogRepositoryMock.findCategoryById).toHaveBeenCalledWith(
        'cat-1',
        true,
      );
      expect(result).toEqual({ id: 'cat-1' });
    });

    it('should throw ApiException if not found', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue(null);

      await expect(service.findOne('cat-1')).rejects.toThrow(
        new ApiException(
          MessageCodes.CATEGORY_NOT_FOUND,
          'Category not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('update', () => {
    const dto = { name: 'New Name', code: 'NEW_CODE' };

    it('should throw ApiException if category not found', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue(null);

      await expect(service.update('cat-1', dto)).rejects.toThrow(
        new ApiException(
          MessageCodes.CATEGORY_NOT_FOUND,
          'Category not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw ApiException if duplicate code exists', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-1',
        code: 'OLD_CODE',
      });
      catalogRepositoryMock.findCategoryByCode.mockResolvedValue({
        id: 'cat-other',
      });

      await expect(service.update('cat-1', dto)).rejects.toThrow(
        new ApiException(
          MessageCodes.CATEGORY_CODE_EXISTS,
          'Category code already exists',
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should update category and evict cache', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-1',
        code: 'OLD_CODE',
      });
      catalogRepositoryMock.findCategoryByCode.mockResolvedValue(null);
      catalogRepositoryMock.updateCategory.mockResolvedValue({
        id: 'cat-1',
        ...dto,
      });
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.update('cat-1', dto);

      expect(catalogRepositoryMock.updateCategory).toHaveBeenCalledWith(
        'cat-1',
        dto,
      );
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:categories:list:*',
      );
      expect(result).toEqual({ id: 'cat-1', ...dto });
    });
  });

  describe('remove', () => {
    it('should throw ApiException if category not found', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue(null);

      await expect(service.remove('cat-1')).rejects.toThrow(
        new ApiException(
          MessageCodes.CATEGORY_NOT_FOUND,
          'Category not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw ApiException if associated services exist', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({ id: 'cat-1' });
      catalogRepositoryMock.countServicesByCategory.mockResolvedValue(5);

      await expect(service.remove('cat-1')).rejects.toThrow(
        new ApiException(
          MessageCodes.CATEGORY_HAS_SERVICES,
          'Cannot delete category with associated services',
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should delete category and evict cache', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({ id: 'cat-1' });
      catalogRepositoryMock.countServicesByCategory.mockResolvedValue(0);
      redisServiceMock.isReady.mockReturnValue(true);

      const result = await service.remove('cat-1');

      expect(catalogRepositoryMock.deleteCategory).toHaveBeenCalledWith(
        'cat-1',
      );
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:categories:list:*',
      );
      expect(result).toBeNull();
    });
  });
});
