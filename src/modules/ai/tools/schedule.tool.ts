import { Injectable, Inject } from '@nestjs/common';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../database/interfaces/booking.repository.interface';

interface SlotWithRelations {
  id: string;
  doctorId: string;
  date: Date;
  startTime: string;
  endTime: string;
  maxPatients: number;
  bookedCount: number;
  doctor: {
    id: string;
    fullName: string;
    doctorProfile?: {
      specialties: string[];
      services: { serviceId: string }[];
    } | null;
  };
  room?: { name: string } | null;
}

@Injectable()
export class ScheduleTool {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async execute(args: {
    serviceId?: string;
    specialtyName?: string;
    date?: string;
    limit?: number;
  }) {
    const { serviceId, specialtyName, date, limit = 5 } = args;

    const findSlots = async (searchDate?: Date, isRange = false) => {
      const getVnDate = (date: Date) => {
        return new Date(
          date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
        );
      };

      const whereClause: Record<string, any> = {
        status: 'SCHEDULED',
        isActive: true,
      };

      if (searchDate) {
        if (isRange) {
          whereClause.date = {
            gte: searchDate,
            lte: new Date(searchDate.getTime() + 7 * 24 * 60 * 60 * 1000), // + 7 days
          };
        } else {
          // Exact date match (ignoring time) in local TZ
          const start = getVnDate(searchDate);
          start.setHours(0, 0, 0, 0);
          const end = getVnDate(searchDate);
          end.setHours(23, 59, 59, 999);
          whereClause.date = { gte: start, lte: end };
        }
      } else {
        // Today and future in local TZ
        const today = getVnDate(new Date());
        today.setHours(0, 0, 0, 0);
        whereClause.date = { gte: today };
      }

      const slots = (await this.bookingRepository.findManyDoctorScheduleSlot({
        where: whereClause,
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
              doctorProfile: {
                select: {
                  specialties: true,
                  services: {
                    select: { serviceId: true },
                  },
                },
              },
            },
          },
          room: {
            select: { name: true },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      })) as unknown as SlotWithRelations[];

      // Filter available and specialty
      return slots
        .filter((slot) => slot.bookedCount < slot.maxPatients)
        .filter((s) => {
          if (!specialtyName) return true;
          return s.doctor.doctorProfile?.specialties.some((sp) =>
            sp.toLowerCase().includes(specialtyName.toLowerCase()),
          );
        })
        .filter((s) => {
          if (!serviceId) return true;
          return s.doctor.doctorProfile?.services.some(
            (sv) => sv.serviceId === serviceId,
          );
        });
    };

    const searchDate = date ? new Date(date) : undefined;
    let filteredSlots = await findSlots(searchDate, false);
    let isFallback = false;

    // If no slots found on specific date, try next 7 days
    if (date && filteredSlots.length === 0) {
      filteredSlots = await findSlots(new Date(), true);
      isFallback = true;
    }

    return {
      slots: filteredSlots.slice(0, limit).map((slot) => {
        const dp = slot.doctor.doctorProfile;
        const defaultServiceId =
          dp?.services && dp.services.length > 0
            ? dp.services[0].serviceId
            : 'unknown';

        return {
          slotId: slot.id,
          doctorId: slot.doctor.id,
          doctorName: slot.doctor.fullName,
          specialties: dp?.specialties,
          serviceId: defaultServiceId,
          date: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(slot.date),
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomName: slot.room?.name,
        };
      }),
      metadata: {
        searchedDate: date || 'today+',
        foundCount: filteredSlots.length,
        isFallbackSuggestions: isFallback,
        message:
          isFallback && filteredSlots.length > 0
            ? `Không có lịch vào ngày ${date}, đây là các gợi ý trong 7 ngày tới.`
            : filteredSlots.length === 0
              ? 'Hiện tại không có lịch khám trống nào phù hợp.'
              : undefined,
      },
    };
  }
}
