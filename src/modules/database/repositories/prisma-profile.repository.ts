import { Injectable } from '@nestjs/common';
import { PatientProfile, Prisma, Gender } from '@prisma/client';
import { IProfileRepository } from '../interfaces/profile.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionClient } from '../interfaces/clinical.repository.interface';
import { PatientFilterInput } from '../types/user.repository.types';

@Injectable()
export class PrismaProfileRepository implements IProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  countPatientProfile(args: Prisma.PatientProfileCountArgs): Promise<number> {
    return this.prisma.patientProfile.count(args);
  }
  findFirstPatientProfile<T extends Prisma.PatientProfileFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.PatientProfileFindFirstArgs>,
  ): Promise<Prisma.PatientProfileGetPayload<T> | null> {
    return this.prisma.patientProfile.findFirst(
      args,
    ) as Promise<Prisma.PatientProfileGetPayload<T> | null>;
  }
  findManyPatientProfile<T extends Prisma.PatientProfileFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.PatientProfileFindManyArgs>,
  ): Promise<Prisma.PatientProfileGetPayload<T>[]> {
    return this.prisma.patientProfile.findMany(args) as Promise<
      Prisma.PatientProfileGetPayload<T>[]
    >;
  }
  findUniquePatientProfile<T extends Prisma.PatientProfileFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PatientProfileFindUniqueArgs>,
  ): Promise<Prisma.PatientProfileGetPayload<T> | null> {
    return this.prisma.patientProfile.findUnique(
      args,
    ) as Promise<Prisma.PatientProfileGetPayload<T> | null>;
  }
  updatePatientProfile(
    args: Prisma.PatientProfileUpdateArgs,
  ): Promise<PatientProfile> {
    return this.prisma.patientProfile.update(args);
  }
  createPatientProfile(
    args: Prisma.PatientProfileCreateArgs,
  ): Promise<PatientProfile> {
    return this.prisma.patientProfile.create(args);
  }
  deletePatientProfile(
    args: Prisma.PatientProfileDeleteArgs,
  ): Promise<PatientProfile> {
    return this.prisma.patientProfile.delete(args);
  }

  findGuestPatientByPhone(
    phone: string,
  ): Promise<Prisma.PatientProfileGetPayload<{
    include: { user: true };
  }> | null> {
    return this.prisma.patientProfile.findFirst({
      where: { phone, isGuest: true, userId: null },
      include: { user: true },
    }) as Promise<Prisma.PatientProfileGetPayload<{
      include: { user: true };
    }> | null>;
  }

  createGuestPatientProfile(
    data: Prisma.PatientProfileCreateArgs,
  ): Promise<PatientProfile> {
    return this.prisma.patientProfile.create(data);
  }

  updatePatientProfileTransaction(
    id: string,
    profileData: Prisma.PatientProfileUpdateInput,
    userData?: Prisma.UserUpdateInput,
  ): Promise<Prisma.PatientProfileGetPayload<{ include: { user: true } }>> {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.patientProfile.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!profile) throw new Error(`PatientProfile not found: ${id}`);

      const updatedProfile = await tx.patientProfile.update({
        where: { id },
        data: profileData,
        include: { user: true },
      });

      if (profile.userId && userData) {
        await tx.user.update({
          where: { id: profile.userId },
          data: userData,
        });
      }

      return updatedProfile;
    });
  }

  async findPatientProfilesWithPagination(
    filters: PatientFilterInput,
  ): Promise<
    [Prisma.PatientProfileGetPayload<{ include: { user: true } }>[], number]
  > {
    const {
      search,
      isGuest,
      page = 1,
      limit = 10,
      gender,
      bloodType,
      status,
    } = filters;

    const pPage = parseInt(String(page), 10) || 1;
    const pLimit = parseInt(String(limit), 10) || 10;
    const skip = (pPage - 1) * pLimit;

    const where: Prisma.PatientProfileWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { patientCode: { contains: search } },
        { nationalId: { contains: search } },
      ];
    }

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    if (gender) {
      const genders = gender.split(',').map((g) => g.trim() as Gender);
      where.gender = { in: genders };
    }

    if (bloodType) {
      const bloodTypes = bloodType.split(',').map((bt) => bt.trim());
      where.bloodType = { in: bloodTypes };
    }

    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      const hasActive = statuses.includes('active');
      const hasInactive = statuses.includes('inactive');
      if (hasActive && !hasInactive) {
        where.user = { isActive: true };
      } else if (hasInactive && !hasActive) {
        where.user = { isActive: false };
      }
    }

    const [profiles, total] = await Promise.all([
      this.prisma.patientProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              avatar: true,
              isActive: true,
              role: true,
            },
          },
        },
        skip,
        take: pLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patientProfile.count({ where }),
    ]);

    return [
      profiles as Prisma.PatientProfileGetPayload<{
        include: { user: true };
      }>[],
      total,
    ];
  }

  countTotalPatients(): Promise<number> {
    return this.prisma.patientProfile.count();
  }

  countPatientsCreatedAfter(date: Date): Promise<number> {
    return this.prisma.patientProfile.count({
      where: { createdAt: { gte: date } },
    });
  }

  countPatientsByDateRange(gte: Date, lte?: Date): Promise<number> {
    return this.prisma.patientProfile.count({
      where: {
        createdAt: {
          gte,
          ...(lte ? { lte } : {}),
        },
      },
    });
  }

  async findPatientProfileByUserId(
    userId: string,
  ): Promise<PatientProfile | null> {
    return this.prisma.patientProfile.findFirst({
      where: { userId },
    });
  }

  async findPatientProfileIdByUserId(userId: string): Promise<string | null> {
    const profile = await this.prisma.patientProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async findPatientProfileById(id: string): Promise<PatientProfile | null> {
    return this.prisma.patientProfile.findUnique({
      where: { id },
    });
  }

  async findAdminPatientsPage(
    filters: {
      search?: string;
      gender?: string;
      status?: string;
      bloodType?: string;
      patientCode?: string;
      isGuest?: boolean;
    },
    page = 1,
    limit = 10,
  ): Promise<
    [
      Prisma.PatientProfileGetPayload<{
        select: {
          id: true;
          fullName: true;
          email: true;
          phone: true;
          gender: true;
          dateOfBirth: true;
          patientCode: true;
          isGuest: true;
          bloodType: true;
          nationalId: true;
          insuranceNumber: true;
          userId: true;
          user: {
            select: {
              id: true;
              avatar: true;
              isActive: true;
            };
          };
        };
      }>[],
      number,
    ]
  > {
    const { search, gender, status, bloodType, patientCode, isGuest } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientProfileWhereInput = {};

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    if (patientCode) {
      where.patientCode = { contains: patientCode };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { patientCode: { contains: search } },
        { insuranceNumber: { contains: search } },
        { nationalId: { contains: search } },
      ];
    }

    if (gender) {
      const genders = gender.split(',').map((g: string) => g.trim() as Gender);
      where.gender = { in: genders };
    }

    if (bloodType) {
      const bloodTypes = bloodType.split(',').map((bt: string) => bt.trim());
      where.bloodType = { in: bloodTypes };
    }

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim());
      const hasActive = statuses.includes('active');
      const hasInactive = statuses.includes('inactive');
      if (hasActive && !hasInactive) {
        where.user = { isActive: true };
      } else if (hasInactive && !hasActive) {
        where.user = { isActive: false };
      }
    }

    const [total, profiles] = await Promise.all([
      this.prisma.patientProfile.count({ where }),
      this.prisma.patientProfile.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          patientCode: true,
          isGuest: true,
          bloodType: true,
          nationalId: true,
          insuranceNumber: true,
          userId: true,
          user: {
            select: {
              id: true,
              avatar: true,
              isActive: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return [profiles, total] as [
      Prisma.PatientProfileGetPayload<{
        select: {
          id: true;
          fullName: true;
          email: true;
          phone: true;
          gender: true;
          dateOfBirth: true;
          patientCode: true;
          isGuest: true;
          bloodType: true;
          nationalId: true;
          insuranceNumber: true;
          userId: true;
          user: {
            select: {
              id: true;
              avatar: true;
              isActive: true;
            };
          };
        };
      }>[],
      number,
    ];
  }

  async findAdminPatientDetailById(
    id: string,
  ): Promise<Prisma.PatientProfileGetPayload<{
    include: {
      user: {
        select: {
          id: true;
          email: true;
          isActive: true;
          isVerified: true;
          avatar: true;
          role: true;
        };
      };
    };
  }> | null> {
    return this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            isVerified: true,
            avatar: true,
            role: true,
          },
        },
      },
    }) as unknown as Promise<Prisma.PatientProfileGetPayload<{
      include: {
        user: {
          select: {
            id: true;
            email: true;
            isActive: true;
            isVerified: true;
            avatar: true;
            role: true;
          };
        };
      };
    }> | null>;
  }

  async findHealthProfile(id: string): Promise<Prisma.PatientProfileGetPayload<{
    select: {
      id: true;
      fullName: true;
      patientCode: true;
      isGuest: true;
      allergies: true;
      chronicConditions: true;
      familyHistory: true;
      bloodType: true;
      heightCm: true;
      weightKg: true;
      occupation: true;
      ethnicity: true;
    };
  }> | null> {
    return this.prisma.patientProfile.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        patientCode: true,
        isGuest: true,
        allergies: true,
        chronicConditions: true,
        familyHistory: true,
        bloodType: true,
        heightCm: true,
        weightKg: true,
        occupation: true,
        ethnicity: true,
      },
    }) as unknown as Promise<Prisma.PatientProfileGetPayload<{
      select: {
        id: true;
        fullName: true;
        patientCode: true;
        isGuest: true;
        allergies: true;
        chronicConditions: true;
        familyHistory: true;
        bloodType: true;
        heightCm: true;
        weightKg: true;
        occupation: true;
        ethnicity: true;
      };
    }> | null>;
  }

  async getPatientDashboardStats(params: {
    startOfToday: Date;
    startOfTomorrow: Date;
    startOfSameLastWeek: Date;
    startOfDayAfterLastWeek: Date;
    startOfMonth: Date;
    startOfLastMonth: Date;
  }): Promise<{
    totalPatients: number;
    totalPatientsLastMonthEnd: number;
    newThisMonth: number;
    newLastMonth: number;
  }> {
    const { startOfMonth, startOfLastMonth } = params;

    const [
      totalPatients,
      totalPatientsLastMonthEnd,
      newThisMonth,
      newLastMonth,
    ] = await Promise.all([
      this.prisma.patientProfile.count({}),
      this.prisma.patientProfile.count({
        where: { createdAt: { lt: startOfMonth } },
      }),
      this.prisma.patientProfile.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.patientProfile.count({
        where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),
    ]);

    return {
      totalPatients,
      totalPatientsLastMonthEnd,
      newThisMonth,
      newLastMonth,
    };
  }

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
