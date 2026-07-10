import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { I_CATALOG_REPOSITORY } from '../database/interfaces/catalog.repository.interface';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';
import { UploadService } from '../upload/upload.service';
import { RedisService } from '../database/services/redis.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { BadRequestException } from '@nestjs/common';
import { MessageCodes } from '../../common/constants/message-codes.const';

describe('ServicesService', () => {
  let service: ServicesService;
  let catalogRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let uploadServiceMock: Record<string, jest.Mock>;
  let redisServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    catalogRepositoryMock = {
      findCategoryById: jest.fn(),
      findServiceByName: jest.fn(),
      createService: jest.fn(),
      findServicesWithFilters: jest.fn(),
      findServiceDetailById: jest.fn(),
      findServiceById: jest.fn(),
      updateService: jest.fn(),
    };

    bookingRepositoryMock = {
      countBookingsByService: jest.fn(),
    };

    uploadServiceMock = {
      deleteIcon: jest.fn(),
    };

    redisServiceMock = {
      isReady: jest.fn().mockReturnValue(false),
      delPattern: jest.fn(),
      getJson: jest.fn(),
      setJson: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: I_CATALOG_REPOSITORY, useValue: catalogRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
        { provide: UploadService, useValue: uploadServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Service',
      description: 'Test Desc',
      iconUrl: 'test-icon.png',
      durationMinutes: 30,
      price: 100000,
      maxSlotsPerHour: 4,
      categoryId: 'cat-id',
    };

    it('should throw BadRequestException if category is invalid', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        new BadRequestException('Invalid category ID'),
      );
    });

    it('should throw ApiException if service name exists', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue({
        id: 'existing-id',
      });

      await expect(service.create(createDto)).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NAME_EXISTS,
          'Service with this name already exists',
          409,
          'Service creation failed',
        ),
      );
    });

    it('should throw BadRequestException if duration is out of range', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);

      await expect(
        service.create({ ...createDto, durationMinutes: 0 }),
      ).rejects.toThrow(
        new BadRequestException('Duration must be between 1 and 120 minutes'),
      );

      await expect(
        service.create({ ...createDto, durationMinutes: 121 }),
      ).rejects.toThrow(
        new BadRequestException('Duration must be between 1 and 120 minutes'),
      );
    });

    it('should throw BadRequestException if max slots per hour is out of range', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);

      await expect(
        service.create({ ...createDto, maxSlotsPerHour: 0 }),
      ).rejects.toThrow(
        new BadRequestException('Max slots per hour must be between 1 and 10'),
      );

      await expect(
        service.create({ ...createDto, maxSlotsPerHour: 11 }),
      ).rejects.toThrow(
        new BadRequestException('Max slots per hour must be between 1 and 10'),
      );
    });

    it('should throw BadRequestException if price is negative', async () => {
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);

      await expect(service.create({ ...createDto, price: -1 })).rejects.toThrow(
        new BadRequestException('Price must be non-negative'),
      );
    });

    it('should create service successfully and evict cache if Redis is ready', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);
      const createdMock = {
        id: 'new-service-id',
        ...createDto,
        isActive: true,
      };
      catalogRepositoryMock.createService.mockResolvedValue(createdMock);

      const result = await service.create(createDto);

      expect(catalogRepositoryMock.createService).toHaveBeenCalledWith({
        ...createDto,
        isActive: true,
        tags: [],
      });
      expect(redisServiceMock.delPattern).toHaveBeenCalledWith(
        'cache:services:list:*',
      );
      expect(result).toEqual(createdMock);
    });
  });

  describe('findAll', () => {
    const filters = { search: 'Test' };
    const mockServices = [{ id: '1', name: 'Test Service' }];

    it('should return cached result if cache hit', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      redisServiceMock.getJson.mockResolvedValue(mockServices);

      const result = await service.findAll(filters);

      expect(redisServiceMock.getJson).toHaveBeenCalledWith(
        `cache:services:list:${JSON.stringify(filters)}`,
      );
      expect(
        catalogRepositoryMock.findServicesWithFilters,
      ).not.toHaveBeenCalled();
      expect(result).toEqual(mockServices);
    });

    it('should query catalogRepository and cache result on cache miss', async () => {
      redisServiceMock.isReady.mockReturnValue(true);
      redisServiceMock.getJson.mockResolvedValue(null);
      catalogRepositoryMock.findServicesWithFilters.mockResolvedValue(
        mockServices,
      );

      const result = await service.findAll(filters);

      expect(
        catalogRepositoryMock.findServicesWithFilters,
      ).toHaveBeenCalledWith(filters);
      expect(redisServiceMock.setJson).toHaveBeenCalledWith(
        `cache:services:list:${JSON.stringify(filters)}`,
        mockServices,
        43200,
      );
      expect(result).toEqual(mockServices);
    });

    it('should fall back to repository directly if Redis is not ready', async () => {
      redisServiceMock.isReady.mockReturnValue(false);
      catalogRepositoryMock.findServicesWithFilters.mockResolvedValue(
        mockServices,
      );

      const result = await service.findAll(filters);

      expect(redisServiceMock.getJson).not.toHaveBeenCalled();
      expect(
        catalogRepositoryMock.findServicesWithFilters,
      ).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockServices);
    });
  });

  describe('findOne', () => {
    it('should return service detail if exists', async () => {
      const mockDetail = { id: 'svc-id', name: 'Service Name' };
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue(mockDetail);

      const result = await service.findOne('svc-id');

      expect(catalogRepositoryMock.findServiceDetailById).toHaveBeenCalledWith(
        'svc-id',
      );
      expect(result).toEqual(mockDetail);
    });

    it('should throw ApiException if service not found', async () => {
      catalogRepositoryMock.findServiceDetailById.mockResolvedValue(null);

      await expect(service.findOne('svc-id')).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Service retrieval failed',
        ),
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Service',
      durationMinutes: 45,
      price: 150000,
      maxSlotsPerHour: 5,
      categoryId: 'new-cat-id',
    };

    it('should throw ApiException if service does not exist', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue(null);

      await expect(service.update('svc-id', updateDto)).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Service update failed',
        ),
      );
    });

    it('should throw BadRequestException if categoryId is invalid', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({ id: 'svc-id' });
      catalogRepositoryMock.findCategoryById.mockResolvedValue(null);

      await expect(service.update('svc-id', updateDto)).rejects.toThrow(
        new BadRequestException('Invalid category ID'),
      );
    });

    it('should throw ApiException if duplicate service name exists', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({ id: 'svc-id' });
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'new-cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue({
        id: 'other-id',
      });

      await expect(service.update('svc-id', updateDto)).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NAME_EXISTS,
          'Service with this name already exists',
          409,
          'Service update failed',
        ),
      );
    });

    it('should call uploadService.deleteIcon if iconUrl changes', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-id',
        iconUrl: 'old-icon.png',
      });
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'new-cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);
      catalogRepositoryMock.updateService.mockResolvedValue({ id: 'svc-id' });

      await service.update('svc-id', {
        ...updateDto,
        iconUrl: 'new-icon.png',
      });

      expect(uploadServiceMock.deleteIcon).toHaveBeenCalledWith('old-icon.png');
    });

    it('should validate duration/slots/price and update service successfully', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({ id: 'svc-id' });
      catalogRepositoryMock.findCategoryById.mockResolvedValue({
        id: 'new-cat-id',
      });
      catalogRepositoryMock.findServiceByName.mockResolvedValue(null);
      catalogRepositoryMock.updateService.mockResolvedValue({ id: 'svc-id' });

      await expect(
        service.update('svc-id', { durationMinutes: 0 }),
      ).rejects.toThrow(
        new BadRequestException('Duration must be between 1 and 120 minutes'),
      );

      await expect(
        service.update('svc-id', { maxSlotsPerHour: 11 }),
      ).rejects.toThrow(
        new BadRequestException('Max slots per hour must be between 1 and 10'),
      );

      await expect(service.update('svc-id', { price: -10 })).rejects.toThrow(
        new BadRequestException('Price must be non-negative'),
      );

      const result = await service.update('svc-id', updateDto);
      expect(catalogRepositoryMock.updateService).toHaveBeenCalledWith(
        'svc-id',
        updateDto,
      );
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should throw ApiException if service not found', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue(null);

      await expect(service.remove('svc-id')).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Service deletion failed',
        ),
      );
    });

    it('should throw ApiException if active bookings exist', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({ id: 'svc-id' });
      bookingRepositoryMock.countBookingsByService.mockResolvedValue(2);

      await expect(service.remove('svc-id')).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_HAS_ACTIVE_BOOKINGS,
          'Cannot delete service with active bookings',
          400,
          'Service deletion failed',
        ),
      );
    });

    it('should delete icon if exists and soft delete service successfully', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-id',
        iconUrl: 'my-icon.png',
      });
      bookingRepositoryMock.countBookingsByService.mockResolvedValue(0);
      catalogRepositoryMock.updateService.mockResolvedValue({
        id: 'svc-id',
        isActive: false,
      });

      const result = await service.remove('svc-id');

      expect(uploadServiceMock.deleteIcon).toHaveBeenCalledWith('my-icon.png');
      expect(catalogRepositoryMock.updateService).toHaveBeenCalledWith(
        'svc-id',
        {
          isActive: false,
        },
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('restore', () => {
    it('should throw ApiException if service not found', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue(null);

      await expect(service.restore('svc-id')).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Service restore failed',
        ),
      );
    });

    it('should throw BadRequestException if service is already active', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-id',
        isActive: true,
      });

      await expect(service.restore('svc-id')).rejects.toThrow(
        new BadRequestException('Service is already active'),
      );
    });

    it('should restore service successfully', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-id',
        isActive: false,
      });
      catalogRepositoryMock.updateService.mockResolvedValue({
        id: 'svc-id',
        isActive: true,
      });

      const result = await service.restore('svc-id');

      expect(catalogRepositoryMock.updateService).toHaveBeenCalledWith(
        'svc-id',
        {
          isActive: true,
        },
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should throw ApiException if service not found', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue(null);

      await expect(service.getStatistics('svc-id')).rejects.toThrow(
        new ApiException(
          MessageCodes.SERVICE_NOT_FOUND,
          'Service not found',
          404,
          'Statistics retrieval failed',
        ),
      );
    });

    it('should return statistics mapped correctly', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-id',
        name: 'Service X',
      });
      bookingRepositoryMock.countBookingsByService
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(2); // cancelled

      const stats = await service.getStatistics('svc-id');

      expect(stats).toEqual({
        service: { id: 'svc-id', name: 'Service X' },
        statistics: {
          totalBookings: 10,
          completedBookings: 8,
          cancelledBookings: 2,
          completionRate: 80,
        },
      });
    });

    it('should handle zero bookings case gracefully', async () => {
      catalogRepositoryMock.findServiceById.mockResolvedValue({
        id: 'svc-id',
        name: 'Service X',
      });
      bookingRepositoryMock.countBookingsByService
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const stats = await service.getStatistics('svc-id');

      expect(stats.statistics.completionRate).toBe(0);
    });
  });
});
