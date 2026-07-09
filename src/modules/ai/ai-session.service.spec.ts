import { Test, TestingModule } from '@nestjs/testing';
import { AiSessionService } from './ai-session.service';
import {
  I_AI_REPOSITORY,
  IAiRepository,
} from '../database/interfaces/ai.repository.interface';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';
import { AiSessionOutcome, AiMessageRole } from '@prisma/client';

type MockAiRepo = Partial<Record<keyof IAiRepository, jest.Mock>>;
type MockProfileRepo = Partial<Record<keyof IProfileRepository, jest.Mock>>;

describe('AiSessionService', () => {
  let service: AiSessionService;
  let aiRepository: MockAiRepo;
  let profileRepository: MockProfileRepo;

  beforeEach(async () => {
    aiRepository = {
      createChatSession: jest.fn(),
      createChatMessage: jest.fn(),
      incrementSessionTokens: jest.fn(),
      endSession: jest.fn(),
      reportSession: jest.fn(),
      checkSessionOwnership: jest.fn(),
      findSessionsPaginated: jest.fn(),
      countSessions: jest.fn(),
      findSessionDetails: jest.fn(),
    };

    profileRepository = {
      findPatientProfileIdByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSessionService,
        { provide: I_AI_REPOSITORY, useValue: aiRepository },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepository },
      ],
    }).compile();

    service = module.get<AiSessionService>(AiSessionService);
  });

  describe('createSession', () => {
    it('should create a session with default modelName when not provided', async () => {
      // Arrange
      const userId = 'user-123';
      const patientProfileId = 'profile-456';
      const sessionId = 'session-abc';

      (profileRepository.findPatientProfileIdByUserId as jest.Mock).mockResolvedValue(patientProfileId);
      (aiRepository.createChatSession as jest.Mock).mockResolvedValue({ id: sessionId });

      // Act
      const result = await service.createSession(userId);

      // Assert
      expect(result).toBe(sessionId);
      expect(aiRepository.createChatSession).toHaveBeenCalledWith({
        userId,
        patientProfileId,
        modelName: 'gemini-2.0-flash',
        outcome: AiSessionOutcome.ONGOING,
      });
    });

    it('should create a session with provided modelName', async () => {
      // Arrange
      const userId = 'user-123';
      const modelName = 'gemini-1.5-pro';
      const sessionId = 'session-xyz';

      (profileRepository.findPatientProfileIdByUserId as jest.Mock).mockResolvedValue(null);
      (aiRepository.createChatSession as jest.Mock).mockResolvedValue({ id: sessionId });

      // Act
      const result = await service.createSession(userId, modelName);

      // Assert
      expect(result).toBe(sessionId);
      expect(aiRepository.createChatSession).toHaveBeenCalledWith({
        userId,
        patientProfileId: null,
        modelName,
        outcome: AiSessionOutcome.ONGOING,
      });
    });

    it('should handle missing patient profile gracefully (patientProfileId = null)', async () => {
      // Arrange
      const userId = 'user-no-profile';
      (profileRepository.findPatientProfileIdByUserId as jest.Mock).mockResolvedValue(null);
      (aiRepository.createChatSession as jest.Mock).mockResolvedValue({ id: 'session-1' });

      // Act
      const result = await service.createSession(userId);

      // Assert
      expect(result).toBe('session-1');
      expect(aiRepository.createChatSession).toHaveBeenCalledWith(
        expect.objectContaining({ patientProfileId: null }),
      );
    });
  });

  describe('saveMessage', () => {
    it('should save a user message with content only', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const role = AiMessageRole.USER;
      const content = 'Hello, I have a headache';
      (aiRepository.createChatMessage as jest.Mock).mockResolvedValue({});

      // Act
      await service.saveMessage(sessionId, role, content);

      // Assert
      expect(aiRepository.createChatMessage).toHaveBeenCalledWith({
        sessionId,
        role,
        content,
        toolName: undefined,
        toolInput: undefined,
        toolOutput: undefined,
        toolError: undefined,
        tokenCount: undefined,
      });
    });

    it('should save an assistant message with tool metadata', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const role = AiMessageRole.MODEL;
      const content = 'Calling search tool...';
      const opts = {
        toolName: 'searchSymptoms',
        toolInput: { query: 'headache' },
        toolOutput: { results: ['migraine', 'tension'] },
        tokenCount: 120,
      };
      (aiRepository.createChatMessage as jest.Mock).mockResolvedValue({});

      // Act
      await service.saveMessage(sessionId, role, content, opts);

      // Assert
      expect(aiRepository.createChatMessage).toHaveBeenCalledWith({
        sessionId,
        role,
        content,
        toolName: opts.toolName,
        toolInput: opts.toolInput,
        toolOutput: opts.toolOutput,
        toolError: undefined,
        tokenCount: opts.tokenCount,
      });
    });
  });

  describe('addTokens', () => {
    it('should increment session tokens via AI repository', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const tokens = 250;
      (aiRepository.incrementSessionTokens as jest.Mock).mockResolvedValue({});

      // Act
      await service.addTokens(sessionId, tokens);

      // Assert
      expect(aiRepository.incrementSessionTokens).toHaveBeenCalledWith(sessionId, tokens);
    });
  });

  describe('endSession', () => {
    it('should end session with outcome and no bookingId', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const outcome = AiSessionOutcome.BOOKING_MADE;
      (aiRepository.endSession as jest.Mock).mockResolvedValue({});

      // Act
      await service.endSession(sessionId, outcome);

      // Assert
      expect(aiRepository.endSession).toHaveBeenCalledWith(sessionId, outcome, undefined);
    });

    it('should end session with outcome and bookingId', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const outcome = AiSessionOutcome.BOOKING_MADE;
      const bookingId = 'booking-789';
      (aiRepository.endSession as jest.Mock).mockResolvedValue({});

      // Act
      await service.endSession(sessionId, outcome, bookingId);

      // Assert
      expect(aiRepository.endSession).toHaveBeenCalledWith(sessionId, outcome, bookingId);
    });
  });

  describe('reportSession', () => {
    it('should report a session with a note', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const note = 'Inappropriate content reported by user';
      (aiRepository.reportSession as jest.Mock).mockResolvedValue({});

      // Act
      await service.reportSession(sessionId, note);

      // Assert
      expect(aiRepository.reportSession).toHaveBeenCalledWith(sessionId, note);
    });

    it('should report a session without a note', async () => {
      // Arrange
      const sessionId = 'session-abc';
      (aiRepository.reportSession as jest.Mock).mockResolvedValue({});

      // Act
      await service.reportSession(sessionId);

      // Assert
      expect(aiRepository.reportSession).toHaveBeenCalledWith(sessionId, undefined);
    });
  });

  describe('listSessions', () => {
    it('should return paginated sessions with mapped fields', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          startedAt: new Date('2026-01-01'),
          endedAt: null,
          outcome: AiSessionOutcome.ONGOING,
          totalTokens: 500,
          _count: { messages: 4 },
          messages: [{ content: 'First message' }],
        },
      ];
      (aiRepository.findSessionsPaginated as jest.Mock).mockResolvedValue(mockSessions);
      (aiRepository.countSessions as jest.Mock).mockResolvedValue(1);

      // Act
      const result = await service.listSessions(userId, 1, 20);

      // Assert
      expect(result.total).toBe(1);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).toMatchObject({
        id: 'session-1',
        totalTokens: 500,
        messageCount: 4,
        firstMessage: 'First message',
      });
      expect(aiRepository.findSessionsPaginated).toHaveBeenCalledWith(userId, 0, 20);
    });

    it('should return null firstMessage when session has no messages', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-2',
          startedAt: new Date(),
          endedAt: null,
          outcome: AiSessionOutcome.ONGOING,
          totalTokens: 0,
          _count: { messages: 0 },
          messages: [],
        },
      ];
      (aiRepository.findSessionsPaginated as jest.Mock).mockResolvedValue(mockSessions);
      (aiRepository.countSessions as jest.Mock).mockResolvedValue(1);

      // Act
      const result = await service.listSessions(userId);

      // Assert
      expect(result.sessions[0].firstMessage).toBeNull();
    });
  });

  describe('getSessionMessages', () => {
    it('should return null when session not found', async () => {
      // Arrange
      (aiRepository.findSessionDetails as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.getSessionMessages('bad-session', 'user-123');

      // Assert
      expect(result).toBeNull();
    });

    it('should return session and messages when found', async () => {
      // Arrange
      const sessionId = 'session-abc';
      const userId = 'user-123';
      const mockDetails = {
        id: sessionId,
        startedAt: new Date('2026-01-01'),
        endedAt: null,
        outcome: AiSessionOutcome.ONGOING,
        messages: [
          {
            id: 'msg-1',
            role: AiMessageRole.USER,
            content: 'Hello',
            toolName: null,
            createdAt: new Date(),
          },
        ],
      };
      (aiRepository.findSessionDetails as jest.Mock).mockResolvedValue(mockDetails);

      // Act
      const result = await service.getSessionMessages(sessionId, userId);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.session.id).toBe(sessionId);
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].role).toBe(AiMessageRole.USER);
      expect(aiRepository.findSessionDetails).toHaveBeenCalledWith(sessionId, userId);
    });
  });

  describe('ownsSession', () => {
    it('should delegate ownership check to AI repository', async () => {
      // Arrange
      (aiRepository.checkSessionOwnership as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.ownsSession('session-abc', 'user-123');

      // Assert
      expect(result).toBe(true);
      expect(aiRepository.checkSessionOwnership).toHaveBeenCalledWith('session-abc', 'user-123');
    });
  });
});
