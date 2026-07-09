import { Injectable, Logger, Inject } from '@nestjs/common';
import { AiSessionOutcome, AiMessageRole } from '@prisma/client';
import {
  I_AI_REPOSITORY,
  IAiRepository,
} from '../database/interfaces/ai.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';

export interface SessionListItem {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  outcome: AiSessionOutcome;
  totalTokens: number;
  messages: Array<{ content: string }>;
  _count: { messages: number };
}

export interface SessionDetails {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  outcome: AiSessionOutcome;
  messages: Array<{
    id: string;
    role: AiMessageRole;
    content: string;
    toolName: string | null;
    createdAt: Date;
  }>;
}

export interface ListSessionsResponse {
  sessions: Array<{
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    outcome: AiSessionOutcome;
    totalTokens: number;
    messageCount: number;
    firstMessage: string | null;
  }>;
  total: number;
}

export interface SessionMessagesResponse {
  session: {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    outcome: AiSessionOutcome;
  };
  messages: Array<{
    id: string;
    role: AiMessageRole;
    content: string;
    toolName: string | null;
    createdAt: Date;
  }>;
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
    const patientProfileId =
      await this.profileRepository.findPatientProfileIdByUserId(userId);

    const session = await this.aiRepository.createChatSession({
      userId,
      patientProfileId,
      modelName: modelName ?? 'gemini-2.0-flash',
      outcome: AiSessionOutcome.ONGOING,
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
    await this.aiRepository.createChatMessage({
      sessionId,
      role,
      content,
      toolName: opts?.toolName,
      toolInput: opts?.toolInput,
      toolOutput: opts?.toolOutput,
      toolError: opts?.toolError,
      tokenCount: opts?.tokenCount,
    });
  }

  async addTokens(sessionId: string, tokens: number): Promise<void> {
    await this.aiRepository.incrementSessionTokens(sessionId, tokens);
  }

  async endSession(
    sessionId: string,
    outcome: AiSessionOutcome,
    bookingId?: string,
  ): Promise<void> {
    await this.aiRepository.endSession(sessionId, outcome, bookingId);
  }

  async reportSession(sessionId: string, note?: string): Promise<void> {
    await this.aiRepository.reportSession(sessionId, note);
  }

  async ownsSession(sessionId: string, userId: string): Promise<boolean> {
    return this.aiRepository.checkSessionOwnership(sessionId, userId);
  }

  async listSessions(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<ListSessionsResponse> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.aiRepository.findSessionsPaginated(userId, skip, limit),
      this.aiRepository.countSessions(userId),
    ]);

    const mappedSessions = (sessions as unknown as SessionListItem[]).map(
      (session) => ({
        id: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        outcome: session.outcome,
        totalTokens: session.totalTokens,
        messageCount: session._count.messages,
        firstMessage: session.messages[0]?.content ?? null,
      }),
    );

    return {
      sessions: mappedSessions,
      total,
    };
  }

  async getSessionMessages(
    sessionId: string,
    userId: string,
  ): Promise<SessionMessagesResponse | null> {
    const session = await this.aiRepository.findSessionDetails(
      sessionId,
      userId,
    );

    if (!session) {
      return null;
    }

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
