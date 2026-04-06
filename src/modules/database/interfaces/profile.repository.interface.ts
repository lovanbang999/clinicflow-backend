import { PatientProfile, Prisma } from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';

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
    filters: Prisma.PatientProfileWhereInput,
    skip: number,
    take: number,
  ): Promise<
    [Prisma.PatientProfileGetPayload<{ include: { user: true } }>[], number]
  >;
  countTotalPatients(): Promise<number>;
  countPatientsCreatedAfter(date: Date): Promise<number>;

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
