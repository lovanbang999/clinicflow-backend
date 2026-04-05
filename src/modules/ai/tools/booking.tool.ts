import { Injectable } from '@nestjs/common';
import { BookingsService } from '../../bookings/bookings.service';
import { BookingSource, BookingPriority } from '@prisma/client';
import { CreateBookingDto } from '../../bookings/dto/create-booking.dto';

@Injectable()
export class BookingTool {
  constructor(private readonly bookingsService: BookingsService) {}

  async execute(args: {
    patientProfileId: string;
    doctorId: string;
    serviceId: string;
    date: string;
    startTime: string;
  }) {
    const { patientProfileId, doctorId, serviceId, date, startTime } = args;

    const createDto = {
      patientProfileId,
      doctorId,
      serviceId,
      bookingDate: date,
      startTime,
      source: BookingSource.ONLINE,
      priority: BookingPriority.NORMAL,
    } as unknown as CreateBookingDto;

    const result = await this.bookingsService.create(
      createDto,
      patientProfileId,
    );

    return {
      status: 'success',
      bookingId: result.data?.id, // used by AiService to mark session BOOKING_MADE
      bookingCode: result.data?.bookingCode,
      message: 'Đặt lịch thành công',
      details: result.data
        ? {
            id: result.data.id,
            bookingDate: result.data.bookingDate,
            startTime: result.data.startTime,
            endTime: result.data.endTime,
            status: result.data.status,
          }
        : null,
    };
  }
}
