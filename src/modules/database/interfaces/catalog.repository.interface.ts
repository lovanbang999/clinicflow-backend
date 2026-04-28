import { Category, Service, Prisma } from '@prisma/client';

export const I_CATALOG_REPOSITORY = 'ICatalogRepository';

export interface FindCategoriesResult {
  total: number;
  items: Category[];
}

export interface ICatalogRepository {
  // Category methods
  findCategoryById(
    id: string,
    includeServiceCount?: boolean,
  ): Promise<Prisma.CategoryGetPayload<{
    include: { _count: { select: { services: true } } };
  }> | null>;
  findCategoryByCode(code: string): Promise<Category | null>;
  createCategory(data: Prisma.CategoryUncheckedCreateInput): Promise<Category>;
  findCategories(
    where: Prisma.CategoryWhereInput,
    skip: number,
    take: number,
  ): Promise<FindCategoriesResult>;
  updateCategory(
    id: string,
    data: Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category>;
  deleteCategory(id: string): Promise<Category>;
  countCategories(where: Prisma.CategoryWhereInput): Promise<number>;
  findManyCategory<T extends Prisma.CategoryFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.CategoryFindManyArgs>,
  ): Promise<Prisma.CategoryGetPayload<T>[]>;

  // Service methods
  countServicesByCategory(categoryId: string): Promise<number>;
  findServiceById(
    id: string,
  ): Promise<Prisma.ServiceGetPayload<{ include: { category: true } }> | null>;
  findServiceByName(name: string, excludeId?: string): Promise<Service | null>;
  createService(data: Prisma.ServiceUncheckedCreateInput): Promise<Service>;
  findServices(
    where: Prisma.ServiceWhereInput,
  ): Promise<Prisma.ServiceGetPayload<{ include: { category: true } }>[]>;
  updateService(
    id: string,
    data: Prisma.ServiceUncheckedUpdateInput,
  ): Promise<Service>;
  findUnique<T extends Prisma.ServiceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ServiceFindUniqueArgs>,
  ): Promise<Prisma.ServiceGetPayload<T> | null>;
  countServices(args?: Prisma.ServiceCountArgs): Promise<number>;
  findManyServices<T extends Prisma.ServiceFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ServiceFindManyArgs>,
  ): Promise<Prisma.ServiceGetPayload<T>[]>;
  findUniqueService<T extends Prisma.ServiceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ServiceFindUniqueArgs>,
  ): Promise<Prisma.ServiceGetPayload<T> | null>;
}
