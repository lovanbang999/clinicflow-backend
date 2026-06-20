import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  I_AI_REPOSITORY,
  IAiRepository,
} from '../database/interfaces/ai.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';
import { AiSessionOutcome, AiMessageRole, Prisma } from '@prisma/client';

@Injectable()
export class AiSessionService {
  private readonly logger = new Logger(AiSessionService.name);

  constructor(
    @Inject(I_AI_REPOSITORY) private readonly aiRepository: IAiRepository,
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  /**
   * Create a new chat session for the user.
   * Resolves patientProfileId automatically from userId if not supplied.
   */
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

  /**
   * Append a single message (user / model / tool) to the session.
   */
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

  /**
   * Accumulate token count into the session total.
   */
  async addTokens(sessionId: string, tokens: number): Promise<void> {
    await this.aiRepository.updateAiChatSession({
      where: { id: sessionId },
      data: { totalTokens: { increment: tokens } },
    });
  }

  /**
   * Mark the session as ended with the given outcome.
   * Optionally link the resulting booking.
   */
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

  /**
   * Record a user-submitted issue report for a session.
   */
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

  /**
   * Check if a session belongs to the given user (authorization guard).
   */
  async ownsSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.aiRepository.findFirstAiChatSession({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    return session !== null;
  }

  /**
   * List paginated chat sessions for a user, newest first.
   * Includes message count and first user message as preview.
   */
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
      sessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        outcome: s.outcome,
        totalTokens: s.totalTokens,
        messageCount: (s as { _count: { messages: number } })._count.messages,
        firstMessage:
          (s as { messages: { content: string }[] }).messages[0]?.content ??
          null,
      })),
      total: total.length,
    };
  }

  /**
   * Get all messages for a specific session.
   * Returns null if session doesn't belong to the user.
   */
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

    return {
      session: {
        id: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        outcome: session.outcome,
      },
      messages: (
        session as {
          messages: {
            id: string;
            role: string;
            content: string;
            toolName: string | null;
            createdAt: Date;
          }[];
        }
      ).messages,
    };
  }
}
