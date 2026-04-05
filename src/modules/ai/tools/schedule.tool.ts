import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScheduleTool {
  constructor(private readonly prisma: PrismaService) {}

  async execute(args: {
    serviceId?: string;
    specialtyName?: string;
    date?: string;
    limit?: number;
  }) {
    const { specialtyName, date, limit = 5 } = args;

    const whereClause: Record<string, any> = {
      status: 'SCHEDULED',
      isActive: true,
    };

    if (date) {
      whereClause.date = new Date(date);
    } else {
      whereClause.date = { gte: new Date() };
    }

    const slots = await this.prisma.doctorScheduleSlot.findMany({
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
    });

    // filter available slots
    const availableSlots = slots.filter(
      (slot) => slot.bookedCount < slot.maxPreBookings,
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
