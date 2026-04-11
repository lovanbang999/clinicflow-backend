import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsCronService } from './bookings-cron.service';
import { BookingsController } from './bookings.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { BillingModule } from '../billing/billing.module';
import { BookingValidatorService } from './services/booking-validator.service';
import { BookingNotificationService } from './services/booking-notification.service';

@Module({
  imports: [DatabaseModule, NotificationsModule, QueueModule, BillingModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingsCronService,
    BookingValidatorService,
    BookingNotificationService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
