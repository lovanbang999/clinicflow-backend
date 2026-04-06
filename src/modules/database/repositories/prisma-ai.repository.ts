import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionClient } from '../interfaces/clinical.repository.interface';
import { IAiRepository } from '../interfaces/ai.repository.interface';

@Injectable()
export class PrismaAiRepository implements IAiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAiChatSession<T extends Prisma.AiChatSessionCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionCreateArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>> {
    return this.prisma.aiChatSession.create(args) as unknown as Promise<
      Prisma.AiChatSessionGetPayload<T>
    >;
  }
  async findFirstAiChatSession<T extends Prisma.AiChatSessionFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatSessionFindFirstArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T> | null> {
    return this.prisma.aiChatSession.findFirst(
      args,
    ) as unknown as Promise<Prisma.AiChatSessionGetPayload<T> | null>;
  }
  async findManyAiChatSession<T extends Prisma.AiChatSessionFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatSessionFindManyArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>[]> {
    return this.prisma.aiChatSession.findMany(args) as unknown as Promise<
      Prisma.AiChatSessionGetPayload<T>[]
    >;
  }
  async findUniqueAiChatSession<T extends Prisma.AiChatSessionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionFindUniqueArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T> | null> {
    return this.prisma.aiChatSession.findUnique(
      args,
    ) as unknown as Promise<Prisma.AiChatSessionGetPayload<T> | null>;
  }
  async updateAiChatSession<T extends Prisma.AiChatSessionUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionUpdateArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>> {
    return this.prisma.aiChatSession.update(args) as unknown as Promise<
      Prisma.AiChatSessionGetPayload<T>
    >;
  }
  async deleteAiChatSession<T extends Prisma.AiChatSessionDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatSessionDeleteArgs>,
  ): Promise<Prisma.AiChatSessionGetPayload<T>> {
    return this.prisma.aiChatSession.delete(args) as unknown as Promise<
      Prisma.AiChatSessionGetPayload<T>
    >;
  }

  async createAiChatMessage<T extends Prisma.AiChatMessageCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageCreateArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>> {
    return this.prisma.aiChatMessage.create(args) as unknown as Promise<
      Prisma.AiChatMessageGetPayload<T>
    >;
  }
  async findFirstAiChatMessage<T extends Prisma.AiChatMessageFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatMessageFindFirstArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T> | null> {
    return this.prisma.aiChatMessage.findFirst(
      args,
    ) as unknown as Promise<Prisma.AiChatMessageGetPayload<T> | null>;
  }
  async findManyAiChatMessage<T extends Prisma.AiChatMessageFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AiChatMessageFindManyArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>[]> {
    return this.prisma.aiChatMessage.findMany(args) as unknown as Promise<
      Prisma.AiChatMessageGetPayload<T>[]
    >;
  }
  async findUniqueAiChatMessage<T extends Prisma.AiChatMessageFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageFindUniqueArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T> | null> {
    return this.prisma.aiChatMessage.findUnique(
      args,
    ) as unknown as Promise<Prisma.AiChatMessageGetPayload<T> | null>;
  }
  async updateAiChatMessage<T extends Prisma.AiChatMessageUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageUpdateArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>> {
    return this.prisma.aiChatMessage.update(args) as unknown as Promise<
      Prisma.AiChatMessageGetPayload<T>
    >;
  }
  async deleteAiChatMessage<T extends Prisma.AiChatMessageDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AiChatMessageDeleteArgs>,
  ): Promise<Prisma.AiChatMessageGetPayload<T>> {
    return this.prisma.aiChatMessage.delete(args) as unknown as Promise<
      Prisma.AiChatMessageGetPayload<T>
    >;
  }

  async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
