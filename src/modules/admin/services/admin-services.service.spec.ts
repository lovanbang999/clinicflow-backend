import { Test, TestingModule } from '@nestjs/testing';
import { AdminServicesService } from './admin-services.service';
import { I_CATALOG_REPOSITORY } from '../../database/interfaces/catalog.repository.interface';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { BadRequestException } from '@nestjs/common';

describe('AdminServicesService', () => {
  let service: AdminServicesService;
  let catalogRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    catalogRepositoryMock = {
      getServiceDashboardStats: jest.fn(),
      findServiceDetailById: jest.fn(),
      findAdminServicesPage: jest.fn(),
      findServiceByName: jest.fn(),
      createService: jest.fn(),
      updateService: jest.fn(),
    };

    bookingRepositoryMock = {
      getMostBookedServiceId: jest.fn(),
      getServiceBookingStats: jest.fn(),
      countActiveBookingsForService: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminServicesService,
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminServicesService>(AdminServicesService);
  });

  describe('getServiceStatistics', () => {
    it('should return statistics mapped correctly, with mostBooked if exists', async () => {
      catalogRepositoryMock.getServiceDashboardStats.mockResolvedValue({
        totalServices: 10,
        activeServices: 8,
        newThisMonth: 1,
      });
      bookingRepositoryMock.getMostBookedServiceId.mockResolvedValue({
        serviceId: 'svc-1',
        count: 15,
      });
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
        name: 'General Checkup',
      });

      const stats = await service.getServiceStatistics();

      expect(catalogRepositoryMock.getServiceDashboardStats).toHaveBeenCalled();
      expect(bookingRepositoryMock.getMostBookedServiceId).toHaveBeenCalled();
      expect(catalogRepositoryMock.findServiceDetailById).toHaveBeenCalledWith(
        'svc-1',
      );
      expect(stats.totalServices).toBe(10);
      expect(stats.activeServices).toBe(8);
      expect(stats.inactiveServices).toBe(2);
      expect(stats.mostBooked).toEqual({
        id: 'svc-1',
        name: 'General Checkup',
        bookingCount: 15,
      });
    });

    it('should return statistics mapped correctly, with null mostBooked if none exists', async () => {
      catalogRepositoryMock.getServiceDashboardStats.mockResolvedValue({
        totalServices: 10,
        activeServices: 8,
        newThisMonth: 1,
      });
      bookingRepositoryMock.getMostBookedServiceId.mockResolvedValue(null);

      const stats = await service.getServiceStatistics();

      expect(stats.mostBooked).toBeNull();
    });
  });

  describe('findAllServices', () => {
    it('should query CatalogRepository findAdminServicesPage', async () => {
      catalogRepositoryMock.findAdminServicesPage.mockResolvedValue([
        [{ id: 'svc-1', name: 'General Checkup' }],
        1,
      ]);

      const result = await service.findAllServices({
        isActive: true,
        search: 'General',
      });

      expect(catalogRepositoryMock.findAdminServicesPage).toHaveBeenCalled();
      expect(result.services.length).toBe(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('findOneService', () => {
    it('should return service detail and stats if exists', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
        name: 'General Checkup',
      });
      bookingRepositoryMock.getServiceBookingStats.mockResolvedValue({
        totalBookings: 10,
        completedBookings: 8,
        cancelledBookings: 2,
      });

      const result = await service.findOneService('svc-1');

      expect(catalogRepositoryMock.findServiceDetailById).toHaveBeenCalledWith(
        'svc-1',
      );
      expect(bookingRepositoryMock.getServiceBookingStats).toHaveBeenCalledWith(
        'svc-1',
      );
      expect(result.stats.completionRate).toBe(80);
    });

    it('should throw SERVICE_NOT_FOUND if service not found', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue(null);

      await expect(service.findOneService('svc-1')).rejects.toThrow(
        ApiException,
      );
    });
  });

  describe('createService', () => {
    const dto = {
      name: 'General Checkup',
      description: 'Checkup desc',
      price: 150000,
      durationMinutes: 30,
      maxSlotsPerHour: 4,
      categoryId: 'cat-1',
      preparationNotes: 'None',
      tags: ['General'],
    };

    it('should throw SERVICE_NAME_EXISTS if service name already exists', async () => {
      catalogRepositoryMock.findServiceByName.mockResolvedValue({
        id: 'svc-existing',
      });

      await expect(service.createService(dto)).rejects.toThrow(ApiException);
    });

    it('should create service successfully if name is unique', async () => {
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);
      catalogRepositoryMock.createService.mockResolvedValue({
        id: 'svc-1',
        name: dto.name,
      });

      const result = await service.createService(dto);

      expect(catalogRepositoryMock.createService).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
    });
  });

  describe('updateService', () => {
    const dto = {
      name: 'Checkup Updated',
      price: 200000,
    };

    it('should throw SERVICE_NOT_FOUND if service does not exist', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue(null);

      await expect(service.updateService('svc-1', dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw SERVICE_NAME_EXISTS if duplicate name is found', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue({
        id: 'svc-other',
      });

      await expect(service.updateService('svc-1', dto)).rejects.toThrow(
        ApiException,
      );
    });

    it('should update service successfully if name is unique', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);
      catalogRepositoryMock.updateService.mockResolvedValue({
        id: 'svc-1',
        name: dto.name,
      });

      const result = await service.updateService('svc-1', dto);

      expect(catalogRepositoryMock.updateService).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
    });
  });

  describe('removeService', () => {
    it('should throw SERVICE_NOT_FOUND if service not found', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue(null);

      await expect(service.removeService('svc-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw BadRequestException if active bookings exist', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
      });
      bookingRepositoryMock.countActiveBookingsForService.mockResolvedValue(5);

      await expect(service.removeService('svc-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should deactivate service successfully if no active bookings exist', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
      });
      bookingRepositoryMock.countActiveBookingsForService.mockResolvedValue(0);
      catalogRepositoryMock.updateService.mockResolvedValue({
        id: 'svc-1',
        isActive: false,
      });

      const result = await service.removeService('svc-1');

      expect(catalogRepositoryMock.updateService).toHaveBeenCalledWith(
        'svc-1',
        { isActive: false },
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('restoreService', () => {
    it('should throw SERVICE_NOT_FOUND if service not found', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue(null);

      await expect(service.restoreService('svc-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should throw BadRequestException if service is already active', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
        isActive: true,
      });

      await expect(service.restoreService('svc-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should restore service successfully', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue({
        id: 'svc-1',
        isActive: false,
      });
      catalogRepositoryMock.updateService.mockResolvedValue({
        id: 'svc-1',
        isActive: true,
      });

      const result = await service.restoreService('svc-1');

      expect(catalogRepositoryMock.updateService).toHaveBeenCalledWith(
        'svc-1',
        { isActive: true },
      );
      expect(result.isActive).toBe(true);
    });
  });
});
