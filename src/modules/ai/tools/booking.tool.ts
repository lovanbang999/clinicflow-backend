import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from '../../bookings/bookings.service';
import { BookingSource, BookingPriority } from '@prisma/client';
import { CreateBookingDto } from '../../bookings/dto/create-booking.dto';

@Injectable()
export class BookingTool {
  private readonly logger = new Logger(BookingTool.name);

  constructor(private readonly bookingsService: BookingsService) {}

  async execute(args: {
    patientProfileId: string;
    userId: string;
    doctorId: string;
    serviceId?: string;
    slotId?: string;
    date: string;
    startTime: string;
    endTime?: string;
  }) {
    const { patientProfileId, userId, doctorId, serviceId, date, startTime } =
      args;

    const isValidUuid = (v?: string) =>
      !!v &&
      v !== 'unknown' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    if (!isValidUuid(patientProfileId) || !isValidUuid(doctorId)) {
      return {
        status: 'error',
        error: true,
        message:
          'Thiếu hoặc sai thông tin bắt buộc (patientProfileId / doctorId). Vui lòng thử lại.',
      };
    }

    const createDto = {
      patientProfileId,
      doctorId,
      ...(isValidUuid(serviceId) ? { serviceId } : {}),
      bookingDate: date,
      startTime,
      isPreBooked: true,
      source: BookingSource.ONLINE,
      priority: BookingPriority.NORMAL,
    } as unknown as CreateBookingDto;

    try {
      const result = await this.bookingsService.create(createDto, userId);

      if (!result?.data?.id) {
        return {
          status: 'error',
          error: true,
          message: 'Tạo lịch khám thất bại: hệ thống không trả về dữ liệu.',
        };
      }

      return {
        status: 'success',
        bookingId: result.data.id,
        bookingCode: result.data.bookingCode,
        message: 'Đặt lịch thành công',
        details: {
          id: result.data.id,
          bookingDate: result.data.bookingDate,
          startTime: result.data.startTime,
          endTime: result.data.endTime,
          status: result.data.status,
        },
      };
    } catch (error) {
      this.logger.error('BookingTool.execute failed:', error);
      const err = error as {
        message?: string;
        response?: {
          message?: string | string[];
          messageCode?: string;
          errorCode?: string;
          errorMessage?: string;
        };
      };

      const detail =
        (Array.isArray(err?.response?.message)
          ? err.response.message.join(', ')
          : err?.response?.message) ||
        err?.message ||
        'Lỗi không xác định';

      const errorCode =
        err?.response?.messageCode || err?.response?.errorCode || '';

      // Patient already has an active booking with this doctor on this date
      const isDuplicate =
        errorCode.includes('DUPLICATE') ||
        (typeof detail === 'string' &&
          detail.toLowerCase().includes('already has an active booking'));

      // Slot taken by another patient concurrently
      const isConflict =
        !isDuplicate &&
        typeof detail === 'string' &&
        (detail.toLowerCase().includes('conflict') ||
          detail.toLowerCase().includes('không còn trống') ||
          detail.toLowerCase().includes('full') ||
          detail.toLowerCase().includes('slot') ||
          detail.toLowerCase().includes('booked'));

      if (isDuplicate) {
        return {
          status: 'error',
          error: true,
          isDuplicate: true,
          message:
            'Bệnh nhân đã có lịch hẹn với bác sĩ này vào ngày đó. Hãy gọi [getMyBookings] để hiển thị lịch hẹn hiện tại, rồi hỏi bệnh nhân có muốn chọn bác sĩ khác hoặc ngày khác không.',
        };
      }

      return {
        status: 'error',
        error: true,
        slotUnavailable: isConflict,
        message: isConflict
          ? `Khung giờ này vừa được bệnh nhân khác đặt. Hãy gọi lại [getAvailableSlots] để lấy danh sách lịch trống mới nhất rồi cho bệnh nhân chọn lại.`
          : `Đặt lịch thất bại: ${detail}. Vui lòng thử lại hoặc đặt lịch tại quầy.`,
      };
    }
  }
}
