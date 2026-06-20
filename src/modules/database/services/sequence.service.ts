import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next atomic sequence number for a given key.
   * This ensures there are no race conditions when generating unique codes.
   */
  async generateNextSequence(key: string): Promise<number> {
    try {
      const result = await this.prisma.sequenceCounter.upsert({
        where: { key },
        create: { key, value: 1 },
        update: { value: { increment: 1 } },
      });
      return result.value;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Fallback if upsert failed due to race condition on insert
        const result = await this.prisma.sequenceCounter.update({
          where: { key },
          data: { value: { increment: 1 } },
        });
        return result.value;
      }
      throw error;
    }
  }
}
