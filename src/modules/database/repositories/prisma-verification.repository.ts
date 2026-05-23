import { Injectable } from '@nestjs/common';
import { IVerificationRepository } from '../interfaces/verification.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationCode, VerificationType } from '@prisma/client';

@Injectable()
export class PrismaVerificationRepository implements IVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    code: string;
    type: VerificationType;
    expiresAt: Date;
  }): Promise<VerificationCode> {
    return this.prisma.verificationCode.create({
      data: {
        userId: data.userId,
        code: data.code,
        type: data.type,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findLatestValidCode(
    userId: string,
    code: string,
    type: VerificationType,
  ): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findFirst({
      where: {
        userId,
        code,
        type,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestCode(
    userId: string,
    type: VerificationType,
  ): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findFirst({
      where: {
        userId,
        type,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAttempts(id: string, attempts: number): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { id },
      data: { attempts },
    });
  }

  async invalidateCode(id: string): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { id },
      data: { isUsed: true },
    });
  }

  async countCodesSince(
    userId: string,
    type: VerificationType,
    since: Date,
  ): Promise<number> {
    return this.prisma.verificationCode.count({
      where: {
        userId,
        type,
        createdAt: {
          gte: since,
        },
      },
    });
  }
}
