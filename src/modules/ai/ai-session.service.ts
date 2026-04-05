import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiSessionOutcome, AiMessageRole, Prisma } from '@prisma/client';

@Injectable()
export class AiSessionService {
  private readonly logger = new Logger(AiSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new chat session for the user.
   * Resolves patientProfileId automatically from userId if not supplied.
   */
  async createSession(userId: string, modelName?: string): Promise<string> {
    const patientProfile = await this.prisma.patientProfile.findFirst({
      where: { userId },
      select: { id: true },
    });

    const session = await this.prisma.aiChatSession.create({
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
    await this.prisma.aiChatMessage.create({
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
    await this.prisma.aiChatSession.update({
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
    await this.prisma.aiChatSession.update({
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
    await this.prisma.aiChatSession.update({
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
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    return session !== null;
  }
}
