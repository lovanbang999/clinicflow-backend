import { Injectable } from '@nestjs/common';
import {
  Prisma,
  AiSessionOutcome,
  AiMessageRole,
  AiChatSession,
  AiChatMessage,
} from '@prisma/client';
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
  async countAiChatSession(
    args?: Prisma.AiChatSessionCountArgs,
  ): Promise<number> {
    return this.prisma.aiChatSession.count(args);
  }

  async findSessionsPaginated(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<unknown[]> {
    return this.prisma.aiChatSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        outcome: true,
        totalTokens: true,
        messages: {
          where: { role: 'USER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { content: true },
        },
        _count: { select: { messages: true } },
      },
    });
  }

  async countSessions(userId: string): Promise<number> {
    return this.prisma.aiChatSession.count({
      where: { userId },
    });
  }

  async findSessionDetails(
    sessionId: string,
    userId: string,
  ): Promise<unknown> {
    return this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        outcome: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            toolName: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async checkSessionOwnership(
    sessionId: string,
    userId: string,
  ): Promise<boolean> {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    return session !== null;
  }

  async createChatSession(data: {
    userId: string;
    patientProfileId: string | null;
    modelName: string;
    outcome: AiSessionOutcome;
  }): Promise<AiChatSession> {
    return this.prisma.aiChatSession.create({
      data: {
        userId: data.userId,
        patientProfileId: data.patientProfileId,
        modelName: data.modelName,
        outcome: data.outcome,
      },
    });
  }

  async createChatMessage(data: {
    sessionId: string;
    role: AiMessageRole;
    content: string;
    toolName?: string | null;
    toolInput?: unknown;
    toolOutput?: unknown;
    toolError?: string | null;
    tokenCount?: number | null;
  }): Promise<AiChatMessage> {
    return this.prisma.aiChatMessage.create({
      data: {
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        toolName: data.toolName ?? null,
        toolInput:
          data.toolInput !== undefined
            ? (data.toolInput as Prisma.InputJsonValue)
            : undefined,
        toolOutput:
          data.toolOutput !== undefined
            ? (data.toolOutput as Prisma.InputJsonValue)
            : undefined,
        toolError: data.toolError ?? null,
        tokenCount: data.tokenCount ?? null,
      },
    });
  }

  async incrementSessionTokens(
    sessionId: string,
    tokens: number,
  ): Promise<AiChatSession> {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { totalTokens: { increment: tokens } },
    });
  }

  async endSession(
    sessionId: string,
    outcome: AiSessionOutcome,
    bookingId?: string | null,
  ): Promise<AiChatSession> {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: {
        outcome,
        bookingId: bookingId ?? null,
        endedAt: new Date(),
      },
    });
  }

  async reportSession(
    sessionId: string,
    note?: string | null,
  ): Promise<AiChatSession> {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: {
        outcome: AiSessionOutcome.REPORTED,
        feedbackNote: note ?? null,
        reportedAt: new Date(),
        endedAt: new Date(),
      },
    });
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
