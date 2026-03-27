import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { subDays } from 'date-fns';

@Injectable()
export class NotificationsCleanupService {
  private readonly logger = new Logger(NotificationsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every night at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup() {
    this.logger.log('Starting notification cleanup task...');

    try {
      const thirtyDaysAgo = subDays(new Date(), 30);

      const result = await this.prisma.notification.deleteMany({
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
