import { Injectable } from '@nestjs/common';
import {
  ICatalogRepository,
  FindCategoriesResult,
  ServiceDetailResult,
  ServiceWithFiltersResult,
  ActiveServiceWithDoctorsResult,
} from '../interfaces/catalog.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { Category, Prisma, Service, Room } from '@prisma/client';

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

  async findActiveServicesWithDoctors(
    serviceIds: string[],
  ): Promise<ActiveServiceWithDoctorsResult[]> {
    return (await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      include: {
        doctorServices: {
          include: {
            doctorProfile: { include: { user: { select: { id: true } } } },
          },
          take: 1,
        },
      },
    })) as unknown as ActiveServiceWithDoctorsResult[];
  }

  async findServicesWithFilters(filters: {
    isActive?: boolean;
    search?: string;
    category?: string;
    categoryType?: 'EXAMINATION' | 'LAB';
    performedBy?: 'TECHNICIAN' | 'DOCTOR';
  }): Promise<ServiceWithFiltersResult[]> {
    const where: Prisma.ServiceWhereInput = {};

    if (filters?.category && filters.category !== 'all') {
      where.categoryId = filters.category;
    }

    if (filters?.categoryType) {
      where.category = {
        type: filters.categoryType,
      };
    }

    if (filters?.performedBy) {
      where.performerType = filters.performedBy;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return this.prisma.service.findMany({
      where,
      include: {
        category: true,
        doctorServices: {
          include: {
            doctorProfile: {
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }) as unknown as Promise<ServiceWithFiltersResult[]>;
  }

  // Room implementations
  async findUniqueRoom<T extends Prisma.RoomFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.RoomFindUniqueArgs>,
  ): Promise<Prisma.RoomGetPayload<T> | null> {
    return this.prisma.room.findUnique(
      args,
    ) as unknown as Promise<Prisma.RoomGetPayload<T> | null>;
  }

  async findFirstRoom<T extends Prisma.RoomFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.RoomFindFirstArgs>,
  ): Promise<Prisma.RoomGetPayload<T> | null> {
    return this.prisma.room.findFirst(
      args,
    ) as unknown as Promise<Prisma.RoomGetPayload<T> | null>;
  }

  async findManyRooms<T extends Prisma.RoomFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.RoomFindManyArgs>,
  ): Promise<Prisma.RoomGetPayload<T>[]> {
    return this.prisma.room.findMany(args) as unknown as Promise<
      Prisma.RoomGetPayload<T>[]
    >;
  }

  async createRoom(data: Prisma.RoomUncheckedCreateInput): Promise<Room> {
    return this.prisma.room.create({ data });
  }

  async updateRoom(
    id: string,
    data: Prisma.RoomUncheckedUpdateInput,
  ): Promise<Room> {
    return this.prisma.room.update({ where: { id }, data });
  }

  async countRooms(args?: Prisma.RoomCountArgs): Promise<number> {
    return this.prisma.room.count(args);
  }

  async findAdminRoomsPage(
    filters: { search?: string; isActive?: boolean },
    page = 1,
    limit = 20,
  ): Promise<
    [
      Prisma.RoomGetPayload<{
        include: {
          _count: { select: { scheduleSlots: true; doctorProfiles: true } };
        };
      }>[],
      number,
    ]
  > {
    const where: Prisma.RoomWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { notes: { contains: filters.search } },
      ];
    }

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        include: {
          _count: { select: { scheduleSlots: true, doctorProfiles: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.room.count({ where }),
    ]);

    return [rooms, total] as [
      Prisma.RoomGetPayload<{
        include: {
          _count: { select: { scheduleSlots: true; doctorProfiles: true } };
        };
      }>[],
      number,
    ];
  }

  async findAdminRoomDetailById(id: string): Promise<Prisma.RoomGetPayload<{
    include: {
      _count: { select: { scheduleSlots: true; doctorProfiles: true } };
    };
  }> | null> {
    return this.prisma.room.findUnique({
      where: { id },
      include: {
        _count: { select: { scheduleSlots: true, doctorProfiles: true } },
      },
    }) as unknown as Promise<Prisma.RoomGetPayload<{
      include: {
        _count: { select: { scheduleSlots: true; doctorProfiles: true } };
      };
    }> | null>;
  }

  async getServiceDashboardStats(startOfMonth: Date): Promise<{
    totalServices: number;
    activeServices: number;
    newThisMonth: number;
  }> {
    const [totalServices, activeServices, newThisMonth] = await Promise.all([
      this.prisma.service.count(),
      this.prisma.service.count({ where: { isActive: true } }),
      this.prisma.service.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      totalServices,
      activeServices,
      newThisMonth,
    };
  }

  async findAdminServicesPage(
    filters: { isActive?: boolean; search?: string; category?: string },
    page = 1,
    limit = 10,
  ): Promise<
    [Prisma.ServiceGetPayload<{ include: { category: true } }>[], number]
  > {
    const { isActive, search, category } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.ServiceWhereInput = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (category && category !== 'all') {
      where.categoryId = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { string_contains: search } },
      ];
    }

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { category: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return [services, total] as [
      Prisma.ServiceGetPayload<{ include: { category: true } }>[],
      number,
    ];
  }

  async findServiceDetailById(id: string): Promise<ServiceDetailResult | null> {
    return this.prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        doctorServices: {
          include: {
            doctorProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    avatar: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    }) as unknown as Promise<ServiceDetailResult | null>;
  }

  async findActiveRooms(): Promise<
    Prisma.RoomGetPayload<{
      select: { id: true; name: true; type: true };
    }>[]
  > {
    return this.prisma.room.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });
  }

  async findRoomByName(name: string): Promise<Room | null> {
    return this.prisma.room.findFirst({
      where: { name },
    });
  }
}
