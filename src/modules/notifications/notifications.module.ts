import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';
import { BookingReminderService } from './booking-reminder.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MailService, BookingReminderService],
  exports: [NotificationsService, MailService],
})
export class NotificationsModule {}
