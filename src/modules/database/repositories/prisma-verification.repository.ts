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
}
