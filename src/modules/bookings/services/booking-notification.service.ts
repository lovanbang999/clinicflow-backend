import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { NotificationsService } from '../../notifications/notifications.service';
import { BookingWithRelations } from '../../database/types/prisma-payload.types';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingNotificationService {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Send booking creation notification
   */
  async sendBookingNotification(booking: BookingWithRelations): Promise<void> {
    const email = booking.patientProfile.email;
    if (!email) return;

    try {
      await this.notificationsService.sendBookingConfirmation({
        bookingId: booking.id,
        patientId: booking.patientProfile.userId ?? undefined,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime ?? '',
        endTime: booking.endTime ?? '',
        duration: booking.service?.durationMinutes ?? 0,
        status: booking.status,
        price: booking.service?.price
          ? Number(booking.service.price)
          : undefined,
        patientNotes: booking.patientNotes ?? undefined,
      });
    } catch (error) {
      console.error('Failed to send booking notification:', error);
    }
  }

  /**
   * Send cancellation notification
   */
  async sendCancellationNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    const email = booking.patientProfile.email;
    if (!email) return;

    try {
      await this.notificationsService.sendBookingCancellation({
        bookingId: booking.id,
        patientId: booking.patientProfile.userId ?? undefined,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime ?? '',
        endTime: booking.endTime ?? '',
        duration: booking.service?.durationMinutes ?? 0,
        status: booking.status,
        price: booking.service?.price
          ? Number(booking.service.price)
          : undefined,
      });
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
    }
  }

  /**
   * Notify admins about booking events
   */
  async notifyAdminsOfBooking(
    booking: BookingWithRelations,
    action: 'CREATED' | 'UPDATED' | 'CANCELLED',
    extraInfo?: string,
  ) {
    let title = 'Thông báo lịch hẹn';
    let content = '';

    switch (action) {
      case 'CREATED':
        title = 'Lịch hẹn mới';
        content = `${booking.patientProfile.fullName} vừa đặt khám ${booking.service?.name ?? 'Dịch vụ chưa xác định'}.`;
        break;
      case 'UPDATED':
        title = 'Cập nhật lịch hẹn';
        content = `Lịch hẹn của ${booking.patientProfile.fullName} đã thay đổi trạng thái sang ${booking.status}.`;
        break;
      case 'CANCELLED':
        title = 'Lịch hẹn đã hủy';
        content = `Lịch hẹn của ${booking.patientProfile.fullName} đã bị hủy. ${extraInfo || ''}`;
        break;
    }

    return this.notificationsService.notifyAdmins({
      title,
      content,
      metadata: { bookingId: booking.id, status: booking.status },
    });
  }

  /**
   * Notify receptionists (e.g., when payment is required after consultation)
   */
  async notifyReceptionistsOfPayment(
    booking: BookingWithRelations,
    serviceName: string,
  ) {
    return this.notificationsService.notifyReceptionists({
      title: 'Chờ thanh toán & Khám chuyên khoa',
      content: `Bệnh nhân ${booking.patientProfile.fullName} đã hoàn tất tư vấn. Cần thanh toán dịch vụ: ${serviceName}.`,
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        type: 'PAYMENT_REQUIRED',
      },
    });
  }

  /**
   * Send status-specific confirmation (Legacy logic from status update)
   */
  async sendStatusSpecificNotification(booking: BookingWithRelations) {
    const email = booking.patientProfile?.email;
    if (!email || booking.status !== BookingStatus.CONFIRMED) return;

    try {
      await this.notificationsService.sendBookingConfirmation({
        bookingId: booking.bookingCode ?? booking.id,
        patientId: booking.patientProfile.userId ?? undefined,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
        bookingDate: format(new Date(booking.bookingDate), 'EEEE, dd/MM/yyyy', {
          locale: vi,
        }),
        startTime: booking.startTime ?? '',
        endTime: booking.endTime ?? '',
        duration: booking.service?.durationMinutes ?? 0,
        status: booking.status,
      });
    } catch (error) {
      console.error('Failed to send confirmation notification:', error);
    }
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
