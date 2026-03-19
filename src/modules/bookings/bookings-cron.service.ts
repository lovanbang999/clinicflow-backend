import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsCronService {
  private readonly logger = new Logger(BookingsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
  ) {}

  /**
   * Automatically marks patients as NO_SHOW if they've been CHECKED_IN
   * but not started (to IN_PROGRESS or COMPLETED) within 30 minutes.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoNoShow() {
    this.logger.debug('Running auto-no-show check...');

    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    // Find bookings that have been checked in for more than 30 minutes and are still waiting
    const overdueBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CHECKED_IN,
        checkedInAt: {
          lt: thirtyMinutesAgo,
        },
      },
      select: {
        id: true,
        bookingCode: true,
      },
    });

    if (overdueBookings.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${overdueBookings.length} overdue bookings. Marking as NO_SHOW.`,
    );

    for (const booking of overdueBookings) {
      try {
        await this.bookingsService.markNoShow(booking.id, 'system-cron');
        this.logger.log(
          `Booking ${booking.bookingCode} auto-marked as NO_SHOW`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to auto-mark booking ${booking.bookingCode} as NO_SHOW: ${message}`,
        );
      }
    }
  }
}
