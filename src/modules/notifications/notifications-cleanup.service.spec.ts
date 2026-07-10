import { NotificationsCleanupService } from './notifications-cleanup.service';
import { I_SYSTEM_REPOSITORY } from '../database/interfaces/system.repository.interface';

describe('NotificationsCleanupService', () => {
  let service: NotificationsCleanupService;
  let mockSystemRepository: {
    deleteNotificationsBefore: jest.Mock<Promise<{ count: number }>, [Date]>;
  };

  beforeEach(() => {
    mockSystemRepository = {
      deleteNotificationsBefore: jest.fn<Promise<{ count: number }>, [Date]>(),
    };

    // Manually instantiate to bypass DI
    service = new NotificationsCleanupService(mockSystemRepository as never);

    // Silence the Inject decorator token complaint by injecting the token mapping
    Object.defineProperty(service, I_SYSTEM_REPOSITORY, {
      value: mockSystemRepository,
      writable: true,
    });
  });

  describe('handleCleanup', () => {
    it('should delete notifications older than 30 days and log count', async () => {
      mockSystemRepository.deleteNotificationsBefore.mockResolvedValue({
        count: 42,
      });

      await service.handleCleanup();

      expect(
        mockSystemRepository.deleteNotificationsBefore,
      ).toHaveBeenCalledTimes(1);
      const passedDate =
        mockSystemRepository.deleteNotificationsBefore.mock.calls[0][0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Should be approximately 30 days ago (within a second tolerance)
      expect(
        Math.abs(passedDate.getTime() - thirtyDaysAgo.getTime()),
      ).toBeLessThan(1000);
    });

    it('should swallow errors without re-throwing', async () => {
      mockSystemRepository.deleteNotificationsBefore.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(service.handleCleanup()).resolves.not.toThrow();
    });
  });
});
