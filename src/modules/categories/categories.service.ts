import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { code: createCategoryDto.code },
    });
    if (existing) {
      throw new ConflictException('Category code already exists');
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

  async findAll(isActive?: string) {
    const where =
      isActive !== undefined ? { isActive: isActive === 'true' } : {};
    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return ResponseHelper.success(
      categories,
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
    if (!category) throw new NotFoundException('Category not found');
    return ResponseHelper.success(
      category,
      'CATEGORY_RETRIEVED',
      'Category retrieved',
      200,
    );
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    if (updateCategoryDto.code && updateCategoryDto.code !== category.code) {
      const existing = await this.prisma.category.findUnique({
        where: { code: updateCategoryDto.code },
      });
      if (existing) throw new ConflictException('Category code already exists');
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
    if (!category) throw new NotFoundException('Category not found');

    const serviceCount = await this.prisma.service.count({
      where: { categoryId: id },
    });
    if (serviceCount > 0) {
      throw new ConflictException(
        'Cannot delete category with associated services',
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
