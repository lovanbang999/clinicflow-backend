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
    doctorId?: string;
    date?: string;
    limit?: number;
  }) {
    const { serviceId, specialtyName, doctorId, date, limit = 5 } = args;

    // Compute Vietnam time constants once (Vietnam is fixed UTC+7, no DST)
    const nowUTC = new Date();
    const todayVN = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(nowUTC); // e.g. "2026-04-20"
    const todayStart = new Date(todayVN + 'T00:00:00.000Z');

    // Current VN wall-clock time as "HH:MM" for past-slot filtering
    const vnNow = new Date(nowUTC.getTime() + 7 * 60 * 60 * 1000);
    const nowTimeVN = `${String(vnNow.getUTCHours()).padStart(2, '0')}:${String(vnNow.getUTCMinutes()).padStart(2, '0')}`;

    const findSlots = async (searchDate?: Date, isRange = false) => {
      const whereClause: Record<string, any> = {
        status: 'SCHEDULED',
        isActive: true,
        ...(doctorId ? { doctorId } : {}),
      };

      if (searchDate) {
        if (isRange) {
          whereClause.date = {
            gte: searchDate,
            lte: new Date(searchDate.getTime() + 7 * 24 * 60 * 60 * 1000), // + 7 days
          };
        } else {
          // Exact date: searchDate from user input "YYYY-MM-DD" is already UTC midnight
          const nextDay = new Date(searchDate.getTime() + 24 * 60 * 60 * 1000);
          whereClause.date = { gte: searchDate, lt: nextDay };
        }
      } else {
        // Today and future in VN timezone
        whereClause.date = { gte: todayStart };
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

      const slotDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      return (
        slots
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
          })
          // Exclude past time slots for today (e.g. it's 22:40 — all 08:00-16:30 slots are over)
          .filter((slot) => {
            const slotDateStr = slotDateFormatter.format(slot.date);
            if (slotDateStr === todayVN) {
              return slot.startTime > nowTimeVN;
            }
            return true;
          })
      );
    };

    const searchDate = date ? new Date(date) : undefined;
    let filteredSlots = await findSlots(searchDate, false);
    let isFallback = false;

    // If no slots found on specific date, try 7 days starting from the requested date
    if (date && filteredSlots.length === 0) {
      filteredSlots = await findSlots(searchDate, true);
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
