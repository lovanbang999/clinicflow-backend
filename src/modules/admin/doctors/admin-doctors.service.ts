import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  I_USER_REPOSITORY,
} from '../../database/interfaces/user.repository.interface';
import { UsersService } from '../../users/users.service';
import { Prisma, UserRole, BookingStatus } from '@prisma/client';
import { ApiException } from '../../../common/exceptions/api.exception';
import { MessageCodes } from '../../../common/constants/message-codes.const';
import { FilterDoctorDto } from './dto/filter-doctor.dto';
import { AdminCreateDoctorDto } from './dto/admin-create-doctor.dto';
import { AdminUpdateDoctorProfileDto } from './dto/admin-update-doctor-profile.dto';
import { AdminSuspendUserDto } from '../users/dto/admin-suspend-user.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDoctorsService {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async getDoctorStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalDoctors, activeDoctors, newThisMonth, profilesWithSpecialties] =
      await Promise.all([
        this.userRepository.count({ where: { role: UserRole.DOCTOR } }),
        this.userRepository.count({
          where: { role: UserRole.DOCTOR, isActive: true },
        }),
        this.userRepository.count({
          where: {
            role: UserRole.DOCTOR,
            createdAt: { gte: startOfMonth },
          },
        }),
        this.userRepository.findManyDoctorProfile({
          select: { specialties: true },
          where: { user: { isActive: true } },
        }),
      ]);

    // Aggregate specialty counts
    const bySpecialty: Record<string, number> = {};
    for (const p of profilesWithSpecialties) {
      if (Array.isArray(p.specialties)) {
        for (const sp of p.specialties as string[]) {
          bySpecialty[sp] = (bySpecialty[sp] ?? 0) + 1;
        }
      }
    }

    return {
      totalDoctors,
      activeDoctors,
      inactiveDoctors: totalDoctors - activeDoctors,
      onLeaveDoctors: 0,
      newThisMonth,
      bySpecialty,
    };
  }

  /**
   * GET /admin/doctors
   * Paginated list with optional specialty / isActive / search filters.
   */
  async findAllDoctors(filterDto: FilterDoctorDto) {
    const { specialty, isActive, search, page = 1, limit = 10 } = filterDto;

    const where: Prisma.UserWhereInput = {
      role: UserRole.DOCTOR,
    };

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (specialty) {
      where.doctorProfile = {
        specialties: { string_contains: specialty },
      };
    }

    const [doctors, total] = await Promise.all([
      this.userRepository.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              id: true,
              specialties: true,
              qualifications: true,
              yearsOfExperience: true,
              bio: true,
              rating: true,
              reviewCount: true,
              consultationFee: true,
              roomId: true,
              room: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.userRepository.count({ where }),
    ]);

    return {
      doctors,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/doctors/:id
   * Full detail of a single doctor including bookings stats.
   */
  async findOneDoctor(id: string) {
    const doctor = await this.userRepository.findFirst({
      where: { id, role: UserRole.DOCTOR },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        gender: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            id: true,
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            rating: true,
            reviewCount: true,
            consultationFee: true,
            roomId: true,
            room: {
              select: {
                id: true,
                name: true,
              },
            },
            services: {
              select: {
                service: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            bookingsAsDoctor: {
              where: { status: BookingStatus.COMPLETED },
            },
          },
        },
      },
    });

    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Doctor retrieval failed',
      );
    }

    return doctor;
  }

  /**
   * PATCH /admin/doctors/:id/profile
   * Update fields on the DoctorProfile table only.
   * If no profile exists yet, it is created (upsert).
   */
  async updateDoctorProfile(id: string, dto: AdminUpdateDoctorProfileDto) {
    // Verify the user exists and is a DOCTOR
    const user = await this.userRepository.findFirst({
      where: { id, role: UserRole.DOCTOR },
    });

    if (!user) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Profile update failed',
      );
    }

    const profile = await this.userRepository.upsertDoctorProfile({
      where: { userId: id },
      create: {
        userId: id,
        specialties: dto.specialties ?? [],
        qualifications: dto.qualifications ?? [],
        yearsOfExperience: dto.yearsOfExperience ?? 0,
        bio: dto.bio ?? null,
        rating: dto.rating ?? 0,
        consultationFee: dto.consultationFee ?? 0,
        roomId: dto.roomId ?? null,
      },
      update: {
        ...(dto.specialties !== undefined && { specialties: dto.specialties }),
        ...(dto.qualifications !== undefined && {
          qualifications: dto.qualifications,
        }),
        ...(dto.yearsOfExperience !== undefined && {
          yearsOfExperience: dto.yearsOfExperience,
        }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.consultationFee !== undefined && {
          consultationFee: dto.consultationFee,
        }),
        ...(dto.roomId !== undefined && { roomId: dto.roomId }),
      },
      select: {
        id: true,
        userId: true,
        specialties: true,
        qualifications: true,
        yearsOfExperience: true,
        bio: true,
        rating: true,
        reviewCount: true,
        consultationFee: true,
        roomId: true,
        room: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    // If serviceIds is provided, sync DoctorService relations
    if (dto.serviceIds !== undefined) {
      await this.prisma.doctorService.deleteMany({
        where: { doctorProfileId: profile.id },
      });
      if (dto.serviceIds.length > 0) {
        await this.prisma.doctorService.createMany({
          data: dto.serviceIds.map((serviceId) => ({
            doctorProfileId: profile.id,
            serviceId,
          })),
        });
      }
    }

    return profile;
  }

  /**
   * PATCH /admin/doctors/:id/status
   * Suspend (isActive=false) or reinstate (isActive=true) a doctor account.
   */
  async toggleDoctorActive(id: string, dto: AdminSuspendUserDto) {
    const doctor = await this.userRepository.findFirst({
      where: { id, role: UserRole.DOCTOR },
    });

    if (!doctor) {
      throw new ApiException(
        MessageCodes.USER_NOT_FOUND,
        'Doctor not found',
        404,
        'Status update failed',
      );
    }

    const updated = await this.userRepository.update(id, {
      isActive: dto.isActive,
    });

    return updated;
  }

  /**
   * Create a new doctor user
   */
  async createDoctor(dto: AdminCreateDoctorDto) {
    return this.usersService.create({
      ...dto,
      role: UserRole.DOCTOR,
    });
  }
}
