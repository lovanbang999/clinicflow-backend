import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import {
  ISystemRepository,
  I_SYSTEM_REPOSITORY,
} from '../database/interfaces/system.repository.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class NotificationsCleanupService {
  private readonly logger = new Logger(NotificationsCleanupService.name);

  constructor(
    @Inject(I_SYSTEM_REPOSITORY)
    private readonly systemRepository: ISystemRepository,
  ) {}

  /**
   * Run every night at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup() {
    this.logger.log('Starting notification cleanup task...');

    try {
      const thirtyDaysAgo = subDays(new Date(), 30);

      const result = await this.systemRepository.deleteManyNotification({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Cleanup successful. Deleted ${result.count} notifications older than 30 days.`,
      );
    } catch (error) {
      this.logger.error('Failed to perform notification cleanup:', error);
    }
  }
}
