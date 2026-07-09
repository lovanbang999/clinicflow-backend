import {
  User,
  DoctorProfile,
  Prisma,
  UserRole,
  DoctorWorkingHours,
  DoctorBreakTime,
  DoctorOffDay,
} from '@prisma/client';
import { UserFilterInput } from '../types/user.repository.types';

export const I_USER_REPOSITORY = 'IUserRepository';

export type UserWithProfile = Prisma.UserGetPayload<{
  include: { patientProfile: true };
}>;

export type TechnicianSpecializationDetail =
  Prisma.TechnicianSpecializationGetPayload<{
    include: { category: { select: { id: true; name: true; code: true } } };
  }>;

export type UserPaginationResult = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    fullName: true;
    phone: true;
    avatar: true;
    dateOfBirth: true;
    gender: true;
    address: true;
    role: true;
    isActive: true;
    createdAt: true;
    updatedAt: true;
    doctorProfile: {
      select: {
        specialties: true;
        qualifications: true;
        yearsOfExperience: true;
        bio: true;
        rating: true;
        reviewCount: true;
      };
    };
    patientProfile: {
      select: { id: true; patientCode: true };
    };
  };
}>;

export type PublicDoctorResult = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    fullName: true;
    phone: true;
    avatar: true;
    dateOfBirth: true;
    gender: true;
    address: true;
    role: true;
    isActive: true;
    createdAt: true;
    updatedAt: true;
    doctorProfile: {
      select: {
        specialties: true;
        qualifications: true;
        yearsOfExperience: true;
        bio: true;
        consultationFee: true;
        rating: true;
        reviewCount: true;
        services: {
          select: {
            service: {
              select: {
                id: true;
                name: true;
                categoryId: true;
                durationMinutes: true;
                price: true;
              };
            };
          };
        };
      };
    };
    workingHours: {
      select: {
        dayOfWeek: true;
        startTime: true;
        endTime: true;
      };
    };
    offDays: {
      select: {
        offDate: true;
        reason: true;
      };
    };
  };
}>;

export type PublicDoctorByIdResult = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    fullName: true;
    phone: true;
    avatar: true;
    gender: true;
    role: true;
    isActive: true;
    createdAt: true;
    updatedAt: true;
    doctorProfile: {
      select: {
        specialties: true;
        qualifications: true;
        yearsOfExperience: true;
        bio: true;
        consultationFee: true;
        rating: true;
        reviewCount: true;
      };
    };
    workingHours: {
      select: {
        dayOfWeek: true;
        startTime: true;
        endTime: true;
      };
    };
    offDays: {
      select: {
        offDate: true;
        reason: true;
      };
    };
  };
}>;

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithProfile(email: string): Promise<UserWithProfile | null>;
  findByPhoneOrEmail(
    phone?: string,
    email?: string,
  ): Promise<UserWithProfile | null>;
  findByPhone(phone: string): Promise<UserWithProfile | null>;
  findById(id: string): Promise<User | null>;
  findByIdWithProfile(id: string): Promise<UserWithProfile | null>;
  findUsersWithPagination(
    filters: UserFilterInput,
  ): Promise<[UserPaginationResult[], number]>;
  findPublicDoctors(
    serviceId?: string,
    page?: number,
    limit?: number,
  ): Promise<[PublicDoctorResult[], number]>;
  findPublicDoctorById(id: string): Promise<PublicDoctorByIdResult | null>;
  createGuestAsUserTransaction(
    guestProfileId: string,
    userData: Prisma.UserCreateInput,
    profileData: Prisma.PatientProfileUpdateInput,
  ): Promise<UserWithProfile>;
  createRegisteredPatient(
    userData: Prisma.UserCreateInput,
    profileData: Prisma.PatientProfileCreateWithoutUserInput,
  ): Promise<UserWithProfile>;
  createAdminUser(
    data: Prisma.UserCreateInput,
    doctorProfileData?: Prisma.DoctorProfileCreateWithoutUserInput,
  ): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;
  softDelete(id: string): Promise<User>;
  getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
    doctorProfileCount: number;
  }>;
  verifyEmailTransaction(
    userId: string,
    verificationCodeId: string,
  ): Promise<void>;
  resetPasswordTransaction(
    userId: string,
    verificationCodeId: string,
    newHashedPassword: string,
  ): Promise<void>;
  findManyDoctorProfile<T extends Prisma.DoctorProfileFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorProfileFindManyArgs>,
  ): Promise<Prisma.DoctorProfileGetPayload<T>[]>;
  upsertDoctorProfile(
    args: Prisma.DoctorProfileUpsertArgs,
  ): Promise<DoctorProfile>;
  findManyDoctorWorkingHours<T extends Prisma.DoctorWorkingHoursFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorWorkingHoursFindManyArgs>,
  ): Promise<Prisma.DoctorWorkingHoursGetPayload<T>[]>;
  findManyDoctorBreakTime<T extends Prisma.DoctorBreakTimeFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorBreakTimeFindManyArgs>,
  ): Promise<Prisma.DoctorBreakTimeGetPayload<T>[]>;
  findManyDoctorOffDay<T extends Prisma.DoctorOffDayFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DoctorOffDayFindManyArgs>,
  ): Promise<Prisma.DoctorOffDayGetPayload<T>[]>;
  findDoctorWorkingHours(doctorId: string): Promise<DoctorWorkingHours[]>;
  findDoctorBreakTimesInDateRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DoctorBreakTime[]>;
  findDoctorOffDaysInDateRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DoctorOffDay[]>;
  findActiveUserIdsByRole(role: UserRole): Promise<string[]>;
  findUnique<T extends Prisma.UserFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>,
  ): Promise<Prisma.UserGetPayload<T> | null>;
  findFirst<T extends Prisma.UserFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>,
  ): Promise<Prisma.UserGetPayload<T> | null>;
  findMany<T extends Prisma.UserFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>,
  ): Promise<Prisma.UserGetPayload<T>[]>;
  count(args: Prisma.UserCountArgs): Promise<number>;
  countActiveDoctors(): Promise<number>;
  countUsersByRoleAndDateRange(
    role: string,
    gte: Date,
    lte?: Date,
  ): Promise<number>;
  getDoctorDashboardStats(startOfMonth: Date): Promise<{
    totalDoctors: number;
    activeDoctors: number;
    newThisMonth: number;
    bySpecialty: Record<string, number>;
  }>;
  findAdminDoctorsPage(
    filters: {
      specialty?: string;
      isActive?: boolean;
      search?: string;
    },
    page?: number,
    limit?: number,
  ): Promise<
    [
      Prisma.UserGetPayload<{
        select: {
          id: true;
          email: true;
          fullName: true;
          phone: true;
          avatar: true;
          isActive: true;
          createdAt: true;
          updatedAt: true;
          doctorProfile: {
            select: {
              id: true;
              specialties: true;
              qualifications: true;
              yearsOfExperience: true;
              bio: true;
              rating: true;
              reviewCount: true;
              consultationFee: true;
              roomId: true;
              room: {
                select: {
                  id: true;
                  name: true;
                };
              };
            };
          };
        };
      }>[],
      number,
    ]
  >;
  findAdminDoctorDetailById(id: string): Promise<Prisma.UserGetPayload<{
    select: {
      id: true;
      email: true;
      fullName: true;
      phone: true;
      avatar: true;
      gender: true;
      address: true;
      isActive: true;
      createdAt: true;
      updatedAt: true;
      doctorProfile: {
        select: {
          id: true;
          specialties: true;
          qualifications: true;
          yearsOfExperience: true;
          bio: true;
          rating: true;
          reviewCount: true;
          consultationFee: true;
          roomId: true;
          room: {
            select: {
              id: true;
              name: true;
            };
          };
          services: {
            select: {
              service: {
                select: {
                  id: true;
                  name: true;
                };
              };
            };
          };
        };
      };
      _count: {
        select: {
          bookingsAsDoctor: {
            where: { status: 'COMPLETED' };
          };
        };
      };
    };
  }> | null>;

  // Relation methods
  syncDoctorServices(
    doctorProfileId: string,
    serviceIds: string[],
  ): Promise<void>;
  addTechnicianSpecialization(
    technicianId: string,
    categoryId: string,
  ): Promise<TechnicianSpecializationDetail>;
  removeTechnicianSpecialization(
    technicianId: string,
    categoryId: string,
  ): Promise<void>;
  findTechnicianSpecializations(
    userId: string,
  ): Promise<{ categoryId: string }[]>;
  findTechnicians(categoryId?: string): Promise<any[]>;
  findByEmailOrPhone(
    email: string,
    phone?: string | null,
  ): Promise<User | null>;
  findDoctorById(id: string): Promise<User | null>;
  findDoctorWithProfile(id: string): Promise<Prisma.UserGetPayload<{
    include: { doctorProfile: true };
  }> | null>;
  upsertDoctorProfileByUserId(
    userId: string,
    data: {
      specialties?: string[];
      qualifications?: string[];
      yearsOfExperience?: number;
      bio?: string | null;
      rating?: number;
      consultationFee?: number;
      roomId?: string | null;
    },
  ): Promise<
    Prisma.DoctorProfileGetPayload<{
      select: {
        id: true;
        userId: true;
        specialties: true;
        qualifications: true;
        yearsOfExperience: true;
        bio: true;
        rating: true;
        reviewCount: true;
        consultationFee: true;
        roomId: true;
        room: {
          select: {
            id: true;
            name: true;
          };
        };
        updatedAt: true;
      };
    }>
  >;
}
