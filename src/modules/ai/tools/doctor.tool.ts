import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DoctorTool {
  constructor(private readonly prisma: PrismaService) {}

  async execute(args: { doctorName: string; specialtyName?: string }) {
    const { doctorName, specialtyName } = args;

    const doctors = await this.prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        isActive: true,
        fullName: { contains: doctorName },
      },
      select: {
        id: true,
        fullName: true,
        doctorProfile: {
          select: {
            specialties: true,
            bio: true,
            yearsOfExperience: true,
            consultationFee: true,
            rating: true,
            services: {
              select: {
                service: {
                  select: { id: true, name: true, price: true },
                },
              },
            },
          },
        },
        workingHours: {
          where: { isActive: true },
          select: { dayOfWeek: true, startTime: true, endTime: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        scheduleSlots: {
          where: {
            status: 'SCHEDULED',
            isActive: true,
            date: { gte: new Date() },
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            maxPatients: true,
            bookedCount: true,
            room: { select: { name: true } },
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: 5,
        },
      },
      take: 5,
    });

    // Filter by specialty if provided
    const filtered = specialtyName
      ? doctors.filter((d) => {
          const specs = d.doctorProfile?.specialties as string[] | undefined;
          if (!specs) return false;
          return specs.some((sp) =>
            sp.toLowerCase().includes(specialtyName.toLowerCase()),
          );
        })
      : doctors;

    if (filtered.length === 0) {
      return {
        found: false,
        message: `Không tìm thấy bác sĩ nào với tên "${doctorName}"${specialtyName ? ` thuộc chuyên khoa "${specialtyName}"` : ''}.`,
        doctors: [],
      };
    }

    return {
      found: true,
      doctors: filtered.map((d) => ({
        doctorId: d.id,
        fullName: d.fullName,
        specialties: d.doctorProfile?.specialties ?? [],
        bio: d.doctorProfile?.bio,
        yearsOfExperience: d.doctorProfile?.yearsOfExperience,
        consultationFee: d.doctorProfile?.consultationFee,
        rating: d.doctorProfile?.rating,
        services: d.doctorProfile?.services.map((s) => ({
          serviceId: s.service.id,
          name: s.service.name,
          price: s.service.price,
        })),
        workingHours: d.workingHours,
        upcomingSlots: d.scheduleSlots
          .filter((s) => s.bookedCount < s.maxPatients)
          .map((s) => ({
            slotId: s.id,
            date: s.date.toISOString().split('T')[0],
            startTime: s.startTime,
            endTime: s.endTime,
            roomName: s.room?.name,
          })),
      })),
    };
  }
}
