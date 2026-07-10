import { Test, TestingModule } from '@nestjs/testing';
import { AdminSettingsService } from './admin-settings.service';
import { I_SYSTEM_REPOSITORY } from '../../database/interfaces/system.repository.interface';

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let systemRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    systemRepositoryMock = {
      findConfigByCategory: jest.fn(),
      upsertConfigValue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSettingsService,
        { provide: I_SYSTEM_REPOSITORY, useValue: systemRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminSettingsService>(AdminSettingsService);
  });

  describe('getSettingsByCategory', () => {
    it('should retrieve configs and cast dataTypes correctly', async () => {
      systemRepositoryMock.findConfigByCategory.mockResolvedValue([
        { key: 'clinic.name', value: 'Smart Clinic', dataType: 'string' },
        { key: 'clinic.capacity', value: '50', dataType: 'number' },
        { key: 'clinic.allowGuest', value: 'true', dataType: 'boolean' },
        {
          key: 'clinic.schedule',
          value: '{"open": 8, "close": 17}',
          dataType: 'json',
        },
        { key: 'clinic.invalidJson', value: '{bad}', dataType: 'json' },
      ]);

      const result = await service.getSettingsByCategory('CLINIC');

      expect(systemRepositoryMock.findConfigByCategory).toHaveBeenCalledWith(
        'CLINIC',
      );
      expect(result.name).toBe('Smart Clinic');
      expect(result.capacity).toBe(50);
      expect(result.allowGuest).toBe(true);
      expect(result.schedule).toEqual({ open: 8, close: 17 });
      expect(result.invalidJson).toEqual({});
    });
  });

  describe('updateSettings', () => {
    it('should upsert each key-value pair with correctly formatted values', async () => {
      systemRepositoryMock.upsertConfigValue.mockResolvedValue({});

      const data = {
        name: 'Smart Clinic New',
        capacity: 100,
        allowGuest: false,
        schedule: { open: 9, close: 18 },
        ignoredField: undefined,
      };

      const result = await service.updateSettings('CLINIC', data, 'admin-1');

      expect(systemRepositoryMock.upsertConfigValue).toHaveBeenCalledTimes(4);
      expect(systemRepositoryMock.upsertConfigValue).toHaveBeenCalledWith(
        'clinic.name',
        'Smart Clinic New',
        'CLINIC',
        'string',
        'admin-1',
      );
      expect(systemRepositoryMock.upsertConfigValue).toHaveBeenCalledWith(
        'clinic.capacity',
        '100',
        'CLINIC',
        'number',
        'admin-1',
      );
      expect(systemRepositoryMock.upsertConfigValue).toHaveBeenCalledWith(
        'clinic.allowGuest',
        'false',
        'CLINIC',
        'boolean',
        'admin-1',
      );
      expect(systemRepositoryMock.upsertConfigValue).toHaveBeenCalledWith(
        'clinic.schedule',
        JSON.stringify({ open: 9, close: 18 }),
        'CLINIC',
        'json',
        'admin-1',
      );
      expect(result).toEqual(data);
    });
  });

  describe('getAllSettings', () => {
    it('should fetch and combine all core categories', async () => {
      systemRepositoryMock.findConfigByCategory
        .mockResolvedValueOnce([
          { key: 'clinic.name', value: 'Clinic A', dataType: 'string' },
        ])
        .mockResolvedValueOnce([
          { key: 'booking.slot', value: '15', dataType: 'number' },
        ])
        .mockResolvedValueOnce([
          { key: 'notification.email', value: 'true', dataType: 'boolean' },
        ])
        .mockResolvedValueOnce([
          { key: 'security.lockout', value: '5', dataType: 'number' },
        ]);

      const result = (await service.getAllSettings()) as Record<
        string,
        Record<string, unknown>
      >;

      expect(systemRepositoryMock.findConfigByCategory).toHaveBeenNthCalledWith(
        1,
        'CLINIC',
      );
      expect(systemRepositoryMock.findConfigByCategory).toHaveBeenNthCalledWith(
        2,
        'BOOKING',
      );
      expect(systemRepositoryMock.findConfigByCategory).toHaveBeenNthCalledWith(
        3,
        'NOTIFICATION',
      );
      expect(systemRepositoryMock.findConfigByCategory).toHaveBeenNthCalledWith(
        4,
        'SECURITY',
      );

      expect(result.clinic?.['name']).toBe('Clinic A');
      expect(result.booking?.['slot']).toBe(15);
      expect(result.notification?.['email']).toBe(true);
      expect(result.security?.['lockout']).toBe(5);
    });
  });
});
