import { Injectable } from '@nestjs/common';
import { PatientProfile, Prisma } from '@prisma/client';
import { IProfileRepository } from '../interfaces/profile.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionClient } from '../interfaces/clinical.repository.interface';

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
    filters: Prisma.PatientProfileWhereInput,
    skip: number,
    take: number,
  ): Promise<
    [Prisma.PatientProfileGetPayload<{ include: { user: true } }>[], number]
  > {
    const [profiles, total] = await Promise.all([
      this.prisma.patientProfile.findMany({
        where: filters,
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
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patientProfile.count({ where: filters }),
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

  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
