import { User, DoctorProfile, Prisma } from '@prisma/client';

export const I_USER_REPOSITORY = 'IUserRepository';

export type UserWithProfile = Prisma.UserGetPayload<{
  include: { patientProfile: true };
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
        rating: true;
        reviewCount: true;
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
  findByIdWithProfile(id: string): Promise<Prisma.UserGetPayload<{
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
  }> | null>;
  findUsersWithPagination(
    filters: Prisma.UserWhereInput,
    skip: number,
    take: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<[UserPaginationResult[], number]>;
  findPublicDoctors(
    filters: Prisma.UserWhereInput,
    skip: number,
    take: number,
  ): Promise<[PublicDoctorResult[], number]>;
  findPublicDoctorById(id: string): Promise<PublicDoctorByIdResult | null>;
  createGuestAsUserTransaction(
    guestProfileId: string,
    userData: Prisma.UserCreateInput,
    profileData: Prisma.PatientProfileUpdateInput,
  ): Promise<Prisma.UserGetPayload<{ include: { patientProfile: true } }>>;
  createRegisteredPatient(
    userData: Prisma.UserCreateInput,
    profileData: Prisma.PatientProfileCreateInput,
  ): Promise<Prisma.UserGetPayload<{ include: { patientProfile: true } }>>;
  createAdminUser(
    data: Prisma.UserCreateInput,
    doctorProfileData?: Prisma.DoctorProfileCreateWithoutUserInput,
  ): Promise<Prisma.UserGetPayload<{ include: { doctorProfile: true } }>>;
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
}
