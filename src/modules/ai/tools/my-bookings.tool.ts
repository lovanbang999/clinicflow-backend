import { Injectable, Inject } from '@nestjs/common';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../database/interfaces/booking.repository.interface';

const ACTIVE_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'AWAITING_RESULTS',
  'QUEUED',
] as const;

@Injectable()
export class MyBookingsTool {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async execute(args: { patientProfileId: string; includeAll?: boolean }) {
    const { patientProfileId, includeAll = false } = args;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const bookings = await this.bookingRepository.findManyBooking({
      where: {
        patientProfileId,
        ...(includeAll
          ? {}
          : { status: { in: ACTIVE_STATUSES as unknown as any } }),
        bookingDate: { gte: todayStart },
      },
      select: {
        id: true,
        bookingCode: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        patientNotes: true,
        doctor: { select: { fullName: true } },
        service: { select: { name: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
      take: 10,
    });

    if (bookings.length === 0) {
      return {
        found: false,
        message: 'Bạn chưa có lịch hẹn sắp tới nào đang hoạt động.',
        bookings: [],
      };
    }

    return {
      found: true,
      count: bookings.length,
      bookings: (bookings as any[]).map((b) => ({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        date: new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(b.bookingDate)),
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        doctorName: b.doctor?.fullName,
        serviceName: b.service?.name,
        roomName: b.room?.name,
        patientNotes: b.patientNotes,
      })),
    };
  }
}
