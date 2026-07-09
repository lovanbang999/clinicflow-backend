import { Category, Service, Room, Prisma, PerformerType } from '@prisma/client';
import {
  ServiceDetailResult,
  ServiceWithFiltersResult,
} from '../types/prisma-payload.types';

export { ServiceDetailResult, ServiceWithFiltersResult };

export const I_CATALOG_REPOSITORY = 'ICatalogRepository';

export interface FindCategoriesResult {
  total: number;
  items: Category[];
}

export interface ActiveServiceWithDoctorsResult {
  id: string;
  name: string;
  price: Prisma.Decimal | number;
  durationMinutes: number;
  maxSlotsPerHour: number | null;
  performerType: PerformerType;
  doctorServices: Array<{
    doctorProfile: {
      user: {
        id: string;
      };
    } | null;
  }>;
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
  findActiveServicesWithDoctors(
    serviceIds: string[],
  ): Promise<ActiveServiceWithDoctorsResult[]>;

  findServicesWithFilters(filters: {
    isActive?: boolean;
    search?: string;
    category?: string;
    categoryType?: 'EXAMINATION' | 'LAB';
    performedBy?: 'TECHNICIAN' | 'DOCTOR';
  }): Promise<ServiceWithFiltersResult[]>;

  // Room methods
  findUniqueRoom<T extends Prisma.RoomFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.RoomFindUniqueArgs>,
  ): Promise<Prisma.RoomGetPayload<T> | null>;
  findFirstRoom<T extends Prisma.RoomFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.RoomFindFirstArgs>,
  ): Promise<Prisma.RoomGetPayload<T> | null>;
  findManyRooms<T extends Prisma.RoomFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.RoomFindManyArgs>,
  ): Promise<Prisma.RoomGetPayload<T>[]>;
  createRoom(data: Prisma.RoomUncheckedCreateInput): Promise<Room>;
  updateRoom(id: string, data: Prisma.RoomUncheckedUpdateInput): Promise<Room>;
  countRooms(args?: Prisma.RoomCountArgs): Promise<number>;
  findAdminRoomsPage(
    filters: { search?: string; isActive?: boolean },
    page?: number,
    limit?: number,
  ): Promise<
    [
      Prisma.RoomGetPayload<{
        include: {
          _count: { select: { scheduleSlots: true; doctorProfiles: true } };
        };
      }>[],
      number,
    ]
  >;
  findAdminRoomDetailById(id: string): Promise<Prisma.RoomGetPayload<{
    include: {
      _count: { select: { scheduleSlots: true; doctorProfiles: true } };
    };
  }> | null>;
  getServiceDashboardStats(startOfMonth: Date): Promise<{
    totalServices: number;
    activeServices: number;
    newThisMonth: number;
  }>;
  findAdminServicesPage(
    filters: { isActive?: boolean; search?: string; category?: string },
    page?: number,
    limit?: number,
  ): Promise<
    [Prisma.ServiceGetPayload<{ include: { category: true } }>[], number]
  >;
  findServiceDetailById(id: string): Promise<ServiceDetailResult | null>;
  findServiceByName(name: string, excludeId?: string): Promise<Service | null>;
  findActiveRooms(): Promise<
    Prisma.RoomGetPayload<{
      select: { id: true; name: true; type: true };
    }>[]
  >;
  findRoomByName(name: string): Promise<Room | null>;
}
