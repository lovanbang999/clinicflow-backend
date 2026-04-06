import { Injectable } from '@nestjs/common';
import { ITokenRepository } from '../interfaces/token.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshToken, User } from '@prisma/client';

@Injectable()
export class PrismaTokenRepository implements ITokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByTokenWithUser(
    token: string,
  ): Promise<(RefreshToken & { user: User }) | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async revokeToken(token: string): Promise<void> {
    // In original code it used updateMany but logically it only needs to revoke the exact token string (or all matching)
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  }
}
