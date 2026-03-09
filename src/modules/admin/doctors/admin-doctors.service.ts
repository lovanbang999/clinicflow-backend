import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserRole, BookingStatus } from '@prisma/client';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';
import { ApiException } from '../../../common/exceptions/api.exception';
import { MessageCodes } from '../../../common/constants/message-codes.const';

import { FilterDoctorDto } from './dto/filter-doctor.dto';
import { AdminUpdateDoctorProfileDto } from './dto/admin-update-doctor-profile.dto';
import { AdminSuspendUserDto } from '../users/dto/admin-suspend-user.dto';

@Injectable()
export class AdminDoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDoctorStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalDoctors, activeDoctors, newThisMonth, profilesWithSpecialties] =
      await Promise.all([
        this.prisma.user.count({ where: { role: UserRole.DOCTOR } }),
        this.prisma.user.count({
          where: { role: UserRole.DOCTOR, isActive: true },
        }),
        this.prisma.user.count({
          where: {
            role: UserRole.DOCTOR,
            createdAt: { gte: startOfMonth },
          },
        }),
        this.prisma.doctorProfile.findMany({
          select: { specialties: true },
          where: { user: { isActive: true } },
        }),
      ]);

    // Aggregate specialty counts
    const bySpecialty: Record<string, number> = {};
    for (const p of profilesWithSpecialties) {
      for (const sp of p.specialties) {
        bySpecialty[sp] = (bySpecialty[sp] ?? 0) + 1;
      }
    }

    return ResponseHelper.success(
      {
        totalDoctors,
        activeDoctors,
        inactiveDoctors: totalDoctors - activeDoctors,
        onLeaveDoctors: 0,
        newThisMonth,
        bySpecialty,
      },
      'ADMIN.DOCTORS.STATISTICS',
      'Doctor statistics retrieved successfully',
      200,
    );
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
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (specialty) {
      where.doctorProfile = {
        specialties: { hasSome: [specialty] },
      };
    }

    const [doctors, total] = await Promise.all([
      this.prisma.user.findMany({
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
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return ResponseHelper.success(
      {
        doctors,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      'ADMIN.DOCTORS.LIST',
      'Doctors retrieved successfully',
      200,
    );
  }

  /**
   * GET /admin/doctors/:id
   * Full detail of a single doctor including bookings stats.
   */
  async findOneDoctor(id: string) {
    const doctor = await this.prisma.user.findFirst({
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

    return ResponseHelper.success(
      doctor,
      'ADMIN.DOCTORS.DETAIL',
      'Doctor retrieved successfully',
      200,
    );
  }

  /**
   * PATCH /admin/doctors/:id/profile
   * Update fields on the DoctorProfile table only.
   * If no profile exists yet, it is created (upsert).
   */
  async updateDoctorProfile(id: string, dto: AdminUpdateDoctorProfileDto) {
    // Verify the user exists and is a DOCTOR
    const user = await this.prisma.user.findFirst({
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

    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        specialties: dto.specialties ?? [],
        qualifications: dto.qualifications ?? [],
        yearsOfExperience: dto.yearsOfExperience ?? 0,
        bio: dto.bio ?? null,
        rating: dto.rating ?? 0,
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
        updatedAt: true,
      },
    });

    return ResponseHelper.success(
      profile,
      'ADMIN.DOCTORS.PROFILE_UPDATED',
      'Doctor profile updated successfully',
      200,
    );
  }

  /**
   * PATCH /admin/doctors/:id/status
   * Suspend (isActive=false) or reinstate (isActive=true) a doctor account.
   */
  async toggleDoctorActive(id: string, dto: AdminSuspendUserDto) {
    const doctor = await this.prisma.user.findFirst({
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

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return ResponseHelper.success(
      updated,
      'ADMIN.DOCTORS.STATUS_UPDATED',
      `Doctor ${dto.isActive ? 'reinstated' : 'suspended'} successfully`,
      200,
    );
  }
}
