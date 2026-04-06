import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../database/interfaces/booking.repository.interface';
import { Inject } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsCronService {
  private readonly logger = new Logger(BookingsCronService.name);

  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    private readonly bookingsService: BookingsService,
  ) {}

  /**
   * No-show timeout: Auto-mark pre-bookings as NO_SHOW if the patient
   * hasn't checked in within 15 minutes AFTER their scheduled appointment time.
   *
   * Walk-in bookings are excluded — they have no fixed scheduled time.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoNoShow() {
    this.logger.debug('Running auto-no-show check for pre-bookings...');

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Calculate the cutoff time: 15 minutes ago (HH:mm string)
    const cutoffDate = new Date(now.getTime() - 15 * 60 * 1000);
    const cutoffTimeStr = `${String(cutoffDate.getHours()).padStart(2, '0')}:${String(cutoffDate.getMinutes()).padStart(2, '0')}`;

    void currentTimeStr;

    // Find pre-bookings that are PENDING/CONFIRMED today, where
    // their startTime was more than 15 minutes ago and patient hasn't checked in.
    const overdueBookings = await this.bookingRepository.findManyBooking({
      where: {
        isPreBooked: true,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
        bookingDate: new Date(today),
        startTime: {
          // startTime <= cutoffTimeStr means appointment was 15+ min ago
          lte: cutoffTimeStr,
        },
        checkedInAt: null,
      },
      select: {
        id: true,
        bookingCode: true,
        doctorId: true,
        bookingDate: true,
      },
    });

    if (overdueBookings.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${overdueBookings.length} overdue pre-bookings. Marking as NO_SHOW.`,
    );

    for (const booking of overdueBookings) {
      try {
        await this.bookingsService.markNoShow(booking.id, 'system-cron');
        this.logger.log(
          `Pre-booking ${booking.bookingCode} auto-marked as NO_SHOW (15-min timeout)`,
        );

        // After freeing the slot, recalculate estimated times for walk-ins
        this.bookingsService
          .recalculateEstimatedTimes(
            booking.doctorId,
            booking.bookingDate.toISOString().split('T')[0],
          )
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to recalculate estimated times: ${msg}`);
          });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to auto-mark booking ${booking.bookingCode} as NO_SHOW: ${message}`,
        );
      }
    }
  }
}
