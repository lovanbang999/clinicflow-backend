/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiSessionService } from './ai-session.service';
import { I_PROFILE_REPOSITORY } from '../database/interfaces/profile.repository.interface';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { of, throwError } from 'rxjs';
import { AiSessionOutcome } from '@prisma/client';

describe('AiController', () => {
  let controller: AiController;
  let aiServiceMock: Record<string, jest.Mock>;
  let aiSessionServiceMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;

  const mockUser = { id: 'u-1' };

  beforeEach(async () => {
    aiServiceMock = {
      chatStream: jest.fn(),
    };
    aiSessionServiceMock = {
      createSession: jest.fn(),
      endSession: jest.fn(),
      reportSession: jest.fn(),
      listSessions: jest.fn(),
      getSessionMessages: jest.fn(),
      ownsSession: jest.fn(),
    };
    profileRepositoryMock = {
      findFirstPatientProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: aiServiceMock },
        { provide: AiSessionService, useValue: aiSessionServiceMock },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepositoryMock },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  describe('chatStream', () => {
    it('should resolve context, create session if none provided, init headers, and stream chat data', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      } as unknown as Response;

      profileRepositoryMock.findFirstPatientProfile.mockResolvedValue({
        id: 'p-1',
        fullName: 'John Doe',
        gender: 'MALE',
        dateOfBirth: new Date('1990-01-01'),
        bloodType: 'O+',
        allergies: 'none',
        chronicConditions: 'none',
      });

      aiSessionServiceMock.createSession.mockResolvedValue('sess-123');
      aiServiceMock.chatStream.mockReturnValue(of({ chunk: 'Hello' }));

      await controller.chatStream([], 'Hi', undefined, mockUser, mockRes);

      expect(aiSessionServiceMock.createSession).toHaveBeenCalledWith('u-1');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"Hello"}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should stream error response if chatStream fails', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      } as unknown as Response;

      profileRepositoryMock.findFirstPatientProfile.mockResolvedValue(null);
      aiServiceMock.chatStream.mockReturnValue(
        throwError(() => new Error('AI Error')),
      );

      await controller.chatStream([], 'Hi', 'sess-123', mockUser, mockRes);

      expect(aiSessionServiceMock.createSession).not.toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalledWith(
        'data: {"error":"AI Error"}\n\n',
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('endSession', () => {
    it('should assert session ownership and end session', async () => {
      aiSessionServiceMock.ownsSession.mockResolvedValue(true);
      aiSessionServiceMock.endSession.mockResolvedValue(undefined);

      await controller.endSession('sess-123', mockUser);

      expect(aiSessionServiceMock.ownsSession).toHaveBeenCalledWith(
        'sess-123',
        'u-1',
      );
      expect(aiSessionServiceMock.endSession).toHaveBeenCalledWith(
        'sess-123',
        AiSessionOutcome.ABANDONED,
      );
    });

    it('should throw ForbiddenException if user does not own session', async () => {
      aiSessionServiceMock.ownsSession.mockResolvedValue(false);

      await expect(controller.endSession('sess-123', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reportSession', () => {
    it('should assert session ownership and report session with note', async () => {
      aiSessionServiceMock.ownsSession.mockResolvedValue(true);
      aiSessionServiceMock.reportSession.mockResolvedValue(undefined);

      await controller.reportSession('sess-123', 'slow response', mockUser);

      expect(aiSessionServiceMock.ownsSession).toHaveBeenCalledWith(
        'sess-123',
        'u-1',
      );
      expect(aiSessionServiceMock.reportSession).toHaveBeenCalledWith(
        'sess-123',
        'slow response',
      );
    });
  });

  describe('listSessions', () => {
    it('should return paginated sessions data', async () => {
      aiSessionServiceMock.listSessions.mockResolvedValue({
        sessions: [{ id: 'sess-1' }],
        total: 1,
      });

      const result = await controller.listSessions('1', '10', mockUser);

      expect(result).toEqual({
        data: [{ id: 'sess-1' }],
        meta: { total: 1 },
      });
      expect(aiSessionServiceMock.listSessions).toHaveBeenCalledWith(
        'u-1',
        1,
        10,
      );
    });
  });

  describe('getSessionMessages', () => {
    it('should return session messages', async () => {
      aiSessionServiceMock.getSessionMessages.mockResolvedValue([
        { id: 'msg-1' },
      ]);

      const result = await controller.getSessionMessages('sess-123', mockUser);

      expect(result).toEqual({ data: [{ id: 'msg-1' }] });
      expect(aiSessionServiceMock.getSessionMessages).toHaveBeenCalledWith(
        'sess-123',
        'u-1',
      );
    });

    it('should throw NotFoundException if messages retrieval returns null/false', async () => {
      aiSessionServiceMock.getSessionMessages.mockResolvedValue(null);

      await expect(
        controller.getSessionMessages('sess-123', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
