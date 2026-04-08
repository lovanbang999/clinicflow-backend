import { Injectable } from '@nestjs/common';
import {
  ICatalogRepository,
  FindCategoriesResult,
} from '../interfaces/catalog.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { Category, Prisma, Service } from '@prisma/client';

@Injectable()
export class PrismaCatalogRepository implements ICatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Category methods
  async findCategoryById(
    id: string,
    includeServiceCount = false,
  ): Promise<Prisma.CategoryGetPayload<{
    include: { _count: { select: { services: true } } };
  }> | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: includeServiceCount
        ? { _count: { select: { services: true } } }
        : undefined,
    }) as unknown as Promise<Prisma.CategoryGetPayload<{
      include: { _count: { select: { services: true } } };
    }> | null>;
  }

  async findCategoryByCode(code: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { code } });
  }

  async createCategory(
    data: Prisma.CategoryUncheckedCreateInput,
  ): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async findCategories(
    where: Prisma.CategoryWhereInput,
    skip: number,
    take: number,
  ): Promise<FindCategoriesResult> {
    const [total, items] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
    ]);
    return { total, items };
  }

  async countCategories(where: Prisma.CategoryWhereInput): Promise<number> {
    return this.prisma.category.count({ where });
  }

  async findManyCategory<T extends Prisma.CategoryFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.CategoryFindManyArgs>,
  ): Promise<Prisma.CategoryGetPayload<T>[]> {
    return this.prisma.category.findMany(args) as unknown as Promise<
      Prisma.CategoryGetPayload<T>[]
    >;
  }

  async updateCategory(
    id: string,
    data: Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string): Promise<Category> {
    return this.prisma.category.delete({ where: { id } });
  }

  // Service methods
  async countServicesByCategory(categoryId: string): Promise<number> {
    return this.prisma.service.count({ where: { categoryId } });
  }

  async findServiceById(
    id: string,
  ): Promise<Prisma.ServiceGetPayload<{ include: { category: true } }> | null> {
    return this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async findServiceByName(
    name: string,
    excludeId?: string,
  ): Promise<Service | null> {
    const where: Prisma.ServiceWhereInput = {
      name: { equals: name },
      isActive: true,
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    return this.prisma.service.findFirst({ where });
  }

  async createService(
    data: Prisma.ServiceUncheckedCreateInput,
  ): Promise<Service> {
    return this.prisma.service.create({ data });
  }

  async findServices(
    where: Prisma.ServiceWhereInput,
  ): Promise<Prisma.ServiceGetPayload<{ include: { category: true } }>[]> {
    return this.prisma.service.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateService(
    id: string,
    data: Prisma.ServiceUncheckedUpdateInput,
  ): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data });
  }
  async findUnique<T extends Prisma.ServiceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ServiceFindUniqueArgs>,
  ): Promise<Prisma.ServiceGetPayload<T> | null> {
    return this.prisma.service.findUnique(
      args,
    ) as unknown as Promise<Prisma.ServiceGetPayload<T> | null>;
  }
  async countServices(args?: Prisma.ServiceCountArgs): Promise<number> {
    return this.prisma.service.count(args);
  }
  async findManyServices<T extends Prisma.ServiceFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ServiceFindManyArgs>,
  ): Promise<Prisma.ServiceGetPayload<T>[]> {
    return this.prisma.service.findMany(args) as unknown as Promise<
      Prisma.ServiceGetPayload<T>[]
    >;
  }

  async findUniqueService<T extends Prisma.ServiceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ServiceFindUniqueArgs>,
  ): Promise<Prisma.ServiceGetPayload<T> | null> {
    return this.prisma.service.findUnique(
      args,
    ) as unknown as Promise<Prisma.ServiceGetPayload<T> | null>;
  }
}
