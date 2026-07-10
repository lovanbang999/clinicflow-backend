import { Test, TestingModule } from '@nestjs/testing';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateClinicProfileDto } from './dto/clinic-profile.dto';
import { UpdateBookingRulesDto } from './dto/booking-rules.dto';
import { UpdateNotificationConfigDto } from './dto/notification-config.dto';
import { BadRequestException } from '@nestjs/common';

describe('AdminSettingsController', () => {
  let controller: AdminSettingsController;
  let serviceMock: Record<string, jest.Mock>;
  const userId = 'admin-user-id';

  beforeEach(async () => {
    serviceMock = {
      getAllSettings: jest.fn(),
      updateSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSettingsController],
      providers: [{ provide: AdminSettingsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminSettingsController>(AdminSettingsController);
  });

  describe('getAllSettings', () => {
    it('should call getAllSettings on service and return result', async () => {
      const allSettings = { CLINIC: {}, BOOKING: {}, NOTIFICATION: {} };
      serviceMock.getAllSettings.mockResolvedValue(allSettings);

      const result = await controller.getAllSettings();

      expect(serviceMock.getAllSettings).toHaveBeenCalled();
      expect(result).toBe(allSettings);
    });
  });

  describe('updateClinicProfile', () => {
    it('should forward clinic profile DTO and userId to service', async () => {
      const dto: UpdateClinicProfileDto = {
        name: 'Smart Clinic',
        email: 'info@smartclinic.com',
        phone: '1234567890',
        address: '123 Main St',
      };
      const expectedResult = { success: true };
      serviceMock.updateSettings.mockResolvedValue(expectedResult);

      const result = await controller.updateClinicProfile(dto, userId);

      expect(serviceMock.updateSettings).toHaveBeenCalledWith(
        'CLINIC',
        dto,
        userId,
      );
      expect(result).toBe(expectedResult);
    });

    it('should propagate BadRequestException from service on clinic profile update', async () => {
      const dto: UpdateClinicProfileDto = { name: '' };
      serviceMock.updateSettings.mockRejectedValue(
        new BadRequestException('Invalid name'),
      );

      await expect(controller.updateClinicProfile(dto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateBookingRules', () => {
    it('should forward booking rules DTO and userId to service', async () => {
      const dto: UpdateBookingRulesDto = {
        slotDuration: 30,
        cancelationWindowHours: 24,
      };
      const expectedResult = { success: true };
      serviceMock.updateSettings.mockResolvedValue(expectedResult);

      const result = await controller.updateBookingRules(dto, userId);

      expect(serviceMock.updateSettings).toHaveBeenCalledWith(
        'BOOKING',
        dto,
        userId,
      );
      expect(result).toBe(expectedResult);
    });
  });

  describe('updateNotifications', () => {
    it('should forward notification config DTO and userId to service', async () => {
      const dto: UpdateNotificationConfigDto = {
        enableEmailReminders: true,
        enableSmsReminders: false,
      };
      const expectedResult = { success: true };
      serviceMock.updateSettings.mockResolvedValue(expectedResult);

      const result = await controller.updateNotifications(dto, userId);

      expect(serviceMock.updateSettings).toHaveBeenCalledWith(
        'NOTIFICATION',
        dto,
        userId,
      );
      expect(result).toBe(expectedResult);
    });
  });
});
