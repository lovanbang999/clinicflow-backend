import { PatientProfile, Prisma } from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';
import { PatientFilterInput } from '../types/user.repository.types';

export const I_PROFILE_REPOSITORY = 'IProfileRepository';

export interface IProfileRepository {
  findGuestPatientByPhone(
    phone: string,
  ): Promise<Prisma.PatientProfileGetPayload<{
    include: { user: true };
  }> | null>;
  createGuestPatientProfile(
    data: Prisma.PatientProfileCreateArgs,
  ): Promise<PatientProfile>;
  updatePatientProfileTransaction(
    id: string,
    profileData: Prisma.PatientProfileUpdateInput,
    userData?: Prisma.UserUpdateInput,
  ): Promise<Prisma.PatientProfileGetPayload<{ include: { user: true } }>>;
  findPatientProfilesWithPagination(
    filters: PatientFilterInput,
  ): Promise<
    [Prisma.PatientProfileGetPayload<{ include: { user: true } }>[], number]
  >;
  countTotalPatients(): Promise<number>;
  countPatientsCreatedAfter(date: Date): Promise<number>;
  countPatientsByDateRange(gte: Date, lte?: Date): Promise<number>;
  findPatientProfileByUserId(userId: string): Promise<PatientProfile | null>;
  findPatientProfileIdByUserId(userId: string): Promise<string | null>;
  findPatientProfileById(id: string): Promise<PatientProfile | null>;
  findAdminPatientsPage(
    filters: {
      search?: string;
      gender?: string;
      status?: string;
      bloodType?: string;
      patientCode?: string;
      isGuest?: boolean;
    },
    page?: number,
    limit?: number,
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
  >;
  findAdminPatientDetailById(
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
  }> | null>;
  findHealthProfile(id: string): Promise<Prisma.PatientProfileGetPayload<{
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
  getPatientDashboardStats(params: {
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
  }>;

  // Generic CRUD — fully generic to preserve include/select return types
  countPatientProfile(args: Prisma.PatientProfileCountArgs): Promise<number>;
  findFirstPatientProfile<T extends Prisma.PatientProfileFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.PatientProfileFindFirstArgs>,
  ): Promise<Prisma.PatientProfileGetPayload<T> | null>;
  findManyPatientProfile<T extends Prisma.PatientProfileFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.PatientProfileFindManyArgs>,
  ): Promise<Prisma.PatientProfileGetPayload<T>[]>;
  findUniquePatientProfile<T extends Prisma.PatientProfileFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PatientProfileFindUniqueArgs>,
  ): Promise<Prisma.PatientProfileGetPayload<T> | null>;
  updatePatientProfile(
    args: Prisma.PatientProfileUpdateArgs,
  ): Promise<PatientProfile>;
  createPatientProfile(
    args: Prisma.PatientProfileCreateArgs,
  ): Promise<PatientProfile>;
  deletePatientProfile(
    args: Prisma.PatientProfileDeleteArgs,
  ): Promise<PatientProfile>;
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
