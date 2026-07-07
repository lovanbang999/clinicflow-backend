import { Injectable, Logger, Inject } from '@nestjs/common';
import { AiSessionOutcome, AiMessageRole, Prisma } from '@prisma/client';
import {
  I_AI_REPOSITORY,
  IAiRepository,
} from '../database/interfaces/ai.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';

interface SessionListItem {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  outcome: AiSessionOutcome;
  totalTokens: number;
  messages: { content: string }[];
  _count: { messages: number };
}

interface SessionDetails {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  outcome: AiSessionOutcome;
  messages: {
    id: string;
    role: string;
    content: string;
    toolName: string | null;
    createdAt: Date;
  }[];
}

@Injectable()
export class AiSessionService {
  private readonly logger = new Logger(AiSessionService.name);

  constructor(
    @Inject(I_AI_REPOSITORY) private readonly aiRepository: IAiRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  async createSession(userId: string, modelName?: string): Promise<string> {
    const patientProfile = await this.profileRepository.findFirstPatientProfile(
      {
        where: { userId },
        select: { id: true },
      },
    );

    const session = await this.aiRepository.createAiChatSession({
      data: {
        userId,
        patientProfileId: patientProfile?.id ?? null,
        modelName: modelName ?? 'gemini-2.5-flash',
        outcome: AiSessionOutcome.ONGOING,
      },
    });

    this.logger.log(`Created AI session ${session.id} for user ${userId}`);
    return session.id;
  }

  async saveMessage(
    sessionId: string,
    role: AiMessageRole,
    content: string,
    opts?: {
      toolName?: string;
      toolInput?: Record<string, unknown>;
      toolOutput?: Record<string, unknown>;
      toolError?: string;
      tokenCount?: number;
    },
  ): Promise<void> {
    await this.aiRepository.createAiChatMessage({
      data: {
        sessionId,
        role,
        content,
        toolName: opts?.toolName ?? null,
        toolInput: opts?.toolInput
          ? (opts.toolInput as Prisma.InputJsonValue)
          : undefined,
        toolOutput: opts?.toolOutput
          ? (opts.toolOutput as Prisma.InputJsonValue)
          : undefined,
        toolError: opts?.toolError ?? null,
        tokenCount: opts?.tokenCount ?? null,
      },
    });
  }

  async addTokens(sessionId: string, tokens: number): Promise<void> {
    await this.aiRepository.updateAiChatSession({
      where: { id: sessionId },
      data: { totalTokens: { increment: tokens } },
    });
  }

  async endSession(
    sessionId: string,
    outcome: AiSessionOutcome,
    bookingId?: string,
  ): Promise<void> {
    await this.aiRepository.updateAiChatSession({
      where: { id: sessionId },
      data: {
        outcome,
        bookingId: bookingId ?? null,
        endedAt: new Date(),
      },
    });
  }

  async reportSession(sessionId: string, note?: string): Promise<void> {
    await this.aiRepository.updateAiChatSession({
      where: { id: sessionId },
      data: {
        outcome: AiSessionOutcome.REPORTED,
        feedbackNote: note ?? null,
        reportedAt: new Date(),
        endedAt: new Date(),
      },
    });
  }

  async ownsSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.aiRepository.findFirstAiChatSession({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    return session !== null;
  }

  async listSessions(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    sessions: {
      id: string;
      startedAt: Date;
      endedAt: Date | null;
      outcome: string;
      totalTokens: number;
      messageCount: number;
      firstMessage: string | null;
    }[];
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.aiRepository.findManyAiChatSession({
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
      }),
      this.aiRepository.findManyAiChatSession({
        where: { userId },
        select: { id: true },
      }),
    ]);

    return {
      sessions: sessions.map((s) => {
        const item = s as unknown as SessionListItem;
        return {
          id: item.id,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          outcome: item.outcome,
          totalTokens: item.totalTokens,
          messageCount: item._count.messages,
          firstMessage: item.messages[0]?.content ?? null,
        };
      }),
      total: total.length,
    };
  }

  async getSessionMessages(
    sessionId: string,
    userId: string,
  ): Promise<{
    session: {
      id: string;
      startedAt: Date;
      endedAt: Date | null;
      outcome: string;
    };
    messages: {
      id: string;
      role: string;
      content: string;
      toolName: string | null;
      createdAt: Date;
    }[];
  } | null> {
    const session = await this.aiRepository.findFirstAiChatSession({
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

    if (!session) return null;

    const details = session as unknown as SessionDetails;

    return {
      session: {
        id: details.id,
        startedAt: details.startedAt,
        endedAt: details.endedAt,
        outcome: details.outcome,
      },
      messages: details.messages,
    };
  }
}
