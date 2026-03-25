import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { BookingStatus } from '@prisma/client';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';

@Injectable()
export class BookingReminderService {
  private readonly logger = new Logger(BookingReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Send 24-hour reminder emails every morning at 8:00 AM
   */
  @Cron('0 8 * * *', {
    name: 'booking-reminder-24h',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async sendTomorrowReminders() {
    this.logger.log('Running 24h booking reminder cron job...');

    const tomorrow = addDays(new Date(), 1);
    const start = startOfDay(tomorrow);
    const end = endOfDay(tomorrow);

    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          bookingDate: { gte: start, lte: end },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        },
        include: {
          patientProfile: { include: { user: { select: { email: true } } } },
          doctor: true,
          service: true,
        },
      });

      this.logger.log(
        `Found ${bookings.length} bookings for tomorrow (${format(tomorrow, 'dd/MM/yyyy')})`,
      );

      for (const booking of bookings) {
        const email = booking.patientProfile?.user?.email;
        if (!email) continue;

        await this.notificationsService.sendBookingReminder({
          bookingId: booking.bookingCode ?? booking.id,
          patientName: booking.patientProfile?.fullName ?? 'Quý bệnh nhân',
          patientEmail: email,
          doctorName: booking.doctor?.fullName ?? 'Bác sĩ',
          serviceName: booking.service?.name ?? 'Khám tổng quát',
          bookingDate: format(tomorrow, 'EEEE, dd/MM/yyyy', { locale: vi }),
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.service?.durationMinutes ?? 30,
          status: booking.status,
        });

        this.logger.log(
          `Reminder sent to ${email} for booking ${booking.bookingCode}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send booking reminders:', error);
    }
  }

  /**
   * Send 1-hour-before reminder — runs every hour at :00
   */
  @Cron('0 * * * *', {
    name: 'booking-reminder-1h',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async sendOneHourReminders() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const targetHour = oneHourLater.getHours().toString().padStart(2, '0');
    const targetDate = format(oneHourLater, 'yyyy-MM-dd');

    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          bookingDate: {
            gte: startOfDay(oneHourLater),
            lte: endOfDay(oneHourLater),
          },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        },
        include: {
          patientProfile: { include: { user: { select: { email: true } } } },
          doctor: true,
          service: true,
        },
      });

      // Filter to only bookings starting in ~1 hour
      const upcomingBookings = bookings.filter((b) => {
        const startHour = b.startTime.slice(0, 2);
        return startHour === targetHour;
      });

      this.logger.log(
        `Found ${upcomingBookings.length} bookings at ${targetHour}:xx on ${targetDate}`,
      );

      for (const booking of upcomingBookings) {
        const email = booking.patientProfile?.user?.email;
        if (!email) continue;

        await this.notificationsService.sendBookingReminder({
          bookingId: booking.bookingCode ?? booking.id,
          patientName: booking.patientProfile?.fullName ?? 'Quý bệnh nhân',
          patientEmail: email,
          doctorName: booking.doctor?.fullName ?? 'Bác sĩ',
          serviceName: booking.service?.name ?? 'Khám tổng quát',
          bookingDate: format(oneHourLater, 'EEEE, dd/MM/yyyy', { locale: vi }),
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.service?.durationMinutes ?? 30,
          status: booking.status,
        });
      }
    } catch (error) {
      this.logger.error('Failed to send 1h booking reminders:', error);
    }
  }
}
