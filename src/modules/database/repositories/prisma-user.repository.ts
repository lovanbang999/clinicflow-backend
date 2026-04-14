import { Injectable } from '@nestjs/common';
import {
  IUserRepository,
  UserWithProfile,
  UserPaginationResult,
  PublicDoctorResult,
  PublicDoctorByIdResult,
} from '../interfaces/user.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { User, UserRole, Prisma, DoctorProfile } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByEmailWithProfile(email: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        patientProfile: true,
      },
    });
  }

  async findByPhoneOrEmail(
    phone?: string,
    email?: string,
  ): Promise<UserWithProfile | null> {
    const OR: Prisma.UserWhereInput[] = [];
    if (phone) OR.push({ phone });
    if (email) OR.push({ email });

    if (OR.length === 0) return null;

    return this.prisma.user.findFirst({
      where: {
        OR,
        role: UserRole.PATIENT,
        deletedAt: null,
      },
      include: {
        patientProfile: true,
      },
    });
  }

  async findByPhone(phone: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { phone, role: UserRole.PATIENT, deletedAt: null },
      include: {
        patientProfile: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithProfile(id: string): Promise<Prisma.UserGetPayload<{
    select: {
      id: true;
      email: true;
      fullName: true;
      phone: true;
      role: true;
      avatar: true;
      isActive: true;
      createdAt: true;
      updatedAt: true;
      patientProfile: { select: { id: true; patientCode: true } };
    };
  }> | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        patientProfile: {
          select: { id: true, patientCode: true },
        },
      },
    });
  }

  async findUsersWithPagination(
    filters: Prisma.UserWhereInput,
    skip: number,
    take: number,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<[UserPaginationResult[], number]> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: filters,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              specialties: true,
              qualifications: true,
              yearsOfExperience: true,
              bio: true,
              rating: true,
              reviewCount: true,
            },
          },
          patientProfile: {
            select: { id: true, patientCode: true },
          },
        },
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({ where: filters }),
    ]);
    return [users, total];
  }

  async findPublicDoctors(
    filters: Prisma.UserWhereInput,
    skip: number,
    take: number,
  ): Promise<[PublicDoctorResult[], number]> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: filters,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              specialties: true,
              qualifications: true,
              yearsOfExperience: true,
              bio: true,
              consultationFee: true,
              rating: true,
              reviewCount: true,
              services: {
                select: {
                  service: {
                    select: {
                      id: true,
                      name: true,
                      categoryId: true,
                      durationMinutes: true,
                      price: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: filters }),
    ]);
    return [users, total];
  }

  async findPublicDoctorById(
    id: string,
  ): Promise<PublicDoctorByIdResult | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        role: 'DOCTOR',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        gender: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            specialties: true,
            qualifications: true,
            yearsOfExperience: true,
            bio: true,
            consultationFee: true,
            rating: true,
            reviewCount: true,
          },
        },
      },
    });
  }

  async createGuestAsUserTransaction(
    guestProfileId: string,
    userData: Prisma.UserCreateInput,
    profileData: Prisma.PatientProfileUpdateInput,
  ): Promise<Prisma.UserGetPayload<{ include: { patientProfile: true } }>> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: userData });

      await tx.patientProfile.update({
        where: { id: guestProfileId },
        data: {
          ...profileData,
          isGuest: false,
          user: { connect: { id: user.id } },
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: { patientProfile: true },
      }) as unknown as Prisma.UserGetPayload<{
        include: { patientProfile: true };
      }>;
    });
  }

  async createRegisteredPatient(
    userData: Prisma.UserCreateInput,
    profileData: Prisma.PatientProfileCreateInput,
  ): Promise<Prisma.UserGetPayload<{ include: { patientProfile: true } }>> {
    return this.prisma.user.create({
      data: {
        ...userData,
        patientProfile: { create: profileData },
      },
      include: {
        patientProfile: true,
      },
    });
  }

  async createAdminUser(
    data: Prisma.UserCreateInput,
    doctorProfileData?: Prisma.DoctorProfileCreateWithoutUserInput,
  ): Promise<Prisma.UserGetPayload<{ include: { doctorProfile: true } }>> {
    const userData: Prisma.UserCreateInput = { ...data };

    if (data.role === UserRole.DOCTOR && doctorProfileData) {
      userData.doctorProfile = { create: doctorProfileData };
    }

    return this.prisma.user.create({
      data: userData,
      include: {
        doctorProfile: true,
      },
    }) as unknown as Promise<
      Prisma.UserGetPayload<{ include: { doctorProfile: true } }>
    >;
  }

  async verifyEmailTransaction(
    userId: string,
    verificationCodeId: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCodeId },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: true, isVerified: true },
      }),
    ]);
  }

  async resetPasswordTransaction(
    userId: string,
    verificationCodeId: string,
    newHashedPassword: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: verificationCodeId },
        data: { isUsed: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { password: newHashedPassword },
      }),
    ]);
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
    doctorProfileCount: number;
  }> {
    const staffRoles = [
      UserRole.ADMIN,
      UserRole.RECEPTIONIST,
      UserRole.TECHNICIAN,
    ];

    const [totalUsers, activeUsers, usersByRole, doctorProfileCount] =
      await Promise.all([
        this.prisma.user.count({
          where: { deletedAt: null, role: { in: staffRoles } },
        }),
        this.prisma.user.count({
          where: { isActive: true, deletedAt: null, role: { in: staffRoles } },
        }),
        this.prisma.user.groupBy({
          by: ['role'],
          where: { deletedAt: null, role: { in: staffRoles } },
          _count: true,
        }),
        this.prisma.doctorProfile.count(),
      ]);

    const roleStats = usersByRole.reduce(
      (acc, item) => {
        acc[item.role] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: roleStats,
      doctorProfileCount,
    };
  }

  async findManyDoctorProfile<T extends Prisma.DoctorProfileFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorProfileFindManyArgs>,
  ): Promise<Prisma.DoctorProfileGetPayload<T>[]> {
    return this.prisma.doctorProfile.findMany(args);
  }

  async upsertDoctorProfile(
    args: Prisma.DoctorProfileUpsertArgs,
  ): Promise<DoctorProfile> {
    return this.prisma.doctorProfile.upsert(args);
  }

  async findManyDoctorWorkingHours<
    T extends Prisma.DoctorWorkingHoursFindManyArgs,
  >(
    args: Prisma.SelectSubset<T, Prisma.DoctorWorkingHoursFindManyArgs>,
  ): Promise<Prisma.DoctorWorkingHoursGetPayload<T>[]> {
    return this.prisma.doctorWorkingHours.findMany(args);
  }

  async findManyDoctorBreakTime<T extends Prisma.DoctorBreakTimeFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorBreakTimeFindManyArgs>,
  ): Promise<Prisma.DoctorBreakTimeGetPayload<T>[]> {
    return this.prisma.doctorBreakTime.findMany(args);
  }

  async findManyDoctorOffDay<T extends Prisma.DoctorOffDayFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorOffDayFindManyArgs>,
  ): Promise<Prisma.DoctorOffDayGetPayload<T>[]> {
    return this.prisma.doctorOffDay.findMany(args);
  }

  async findUnique<T extends Prisma.UserFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>,
  ): Promise<Prisma.UserGetPayload<T> | null> {
    return this.prisma.user.findUnique(args);
  }

  async findFirst<T extends Prisma.UserFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>,
  ): Promise<Prisma.UserGetPayload<T> | null> {
    return this.prisma.user.findFirst(args);
  }

  async findMany<T extends Prisma.UserFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>,
  ): Promise<Prisma.UserGetPayload<T>[]> {
    return this.prisma.user.findMany(args);
  }

  async count(args: Prisma.UserCountArgs): Promise<number> {
    return this.prisma.user.count(args);
  }
}
