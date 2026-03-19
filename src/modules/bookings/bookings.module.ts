import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsCronService } from './bookings-cron.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, NotificationsModule, QueueModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCronService],
  exports: [BookingsService],
})
export class BookingsModule {}
