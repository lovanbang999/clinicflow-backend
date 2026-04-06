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
    doctorProfile?: { specialties: string[] } | null;
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
    const { specialtyName, date, limit = 5 } = args;

    const whereClause: Record<string, unknown> = {
      status: 'SCHEDULED',
      isActive: true,
    };

    if (date) {
      whereClause.date = new Date(date);
    } else {
      whereClause.date = { gte: new Date() };
    }

    const slots = (await this.bookingRepository.findManyDoctorScheduleSlot({
      where: whereClause,
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            doctorProfile: {
              select: { specialties: true },
            },
          },
        },
        room: {
          select: { name: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })) as unknown as SlotWithRelations[];

    // filter available slots
    const availableSlots = slots.filter(
      (slot) => slot.bookedCount < slot.maxPatients,
    );

    // Filter by specialty if provided
    let filteredSlots = availableSlots;
    if (specialtyName) {
      filteredSlots = filteredSlots.filter((s) =>
        s.doctor.doctorProfile?.specialties.some((sp) =>
          sp.toLowerCase().includes(specialtyName.toLowerCase()),
        ),
      );
    }

    return filteredSlots.slice(0, limit).map((slot) => ({
      slotId: slot.id,
      doctorId: slot.doctor.id,
      doctorName: slot.doctor.fullName,
      specialties: slot.doctor.doctorProfile?.specialties,
      date: slot.date.toISOString().split('T')[0],
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: slot.room?.name,
    }));
  }
}
