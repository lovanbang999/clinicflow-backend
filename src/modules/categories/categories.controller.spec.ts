import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  describe('create', () => {
    it('should forward CreateCategoryDto to service and return result', async () => {
      const dto: CreateCategoryDto = {
        code: 'CAT-001',
        name: 'Eye Care',
        description: 'Ophthalmology services',
      };
      const expectedResult = { id: 'cat-123', ...dto };
      serviceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate ConflictException from service', async () => {
      const dto: CreateCategoryDto = {
        code: 'CAT-001',
        name: 'Eye Care',
        description: 'Ophthalmology services',
      };
      serviceMock.create.mockRejectedValue(
        new ConflictException('Category exists'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should forward CategoryQueryDto to service and return result', async () => {
      const query: CategoryQueryDto = {
        isActive: true,
        page: 1,
        limit: 10,
      };
      const expectedResult = [{ id: 'cat-123', name: 'Eye Care' }];
      serviceMock.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(serviceMock.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should call findOne with id and return category', async () => {
      const catId = 'cat-uuid';
      const category = { id: catId, name: 'Eye Care' };
      serviceMock.findOne.mockResolvedValue(category);

      const result = await controller.findOne(catId);

      expect(serviceMock.findOne).toHaveBeenCalledWith(catId);
      expect(result).toBe(category);
    });

    it('should propagate NotFoundException from service', async () => {
      const catId = 'invalid-uuid';
      serviceMock.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(catId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call update with id and DTO and return updated category', async () => {
      const catId = 'cat-uuid';
      const dto: UpdateCategoryDto = { name: 'Advanced Eye Care' };
      const expectedResult = { id: catId, name: 'Advanced Eye Care' };
      serviceMock.update.mockResolvedValue(expectedResult);

      const result = await controller.update(catId, dto);

      expect(serviceMock.update).toHaveBeenCalledWith(catId, dto);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from service during update', async () => {
      const catId = 'invalid-uuid';
      const dto: UpdateCategoryDto = { name: 'Advanced Eye Care' };
      serviceMock.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(catId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should call remove with id and return value', async () => {
      const catId = 'cat-uuid';
      const expectedResult = { id: catId, success: true };
      serviceMock.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(catId);

      expect(serviceMock.remove).toHaveBeenCalledWith(catId);
      expect(result).toBe(expectedResult);
    });

    it('should propagate NotFoundException from remove endpoint', async () => {
      const catId = 'invalid-uuid';
      serviceMock.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(catId)).rejects.toThrow(NotFoundException);
    });
  });
});
