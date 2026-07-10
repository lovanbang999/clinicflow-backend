import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './ai.provider';
import { SpecialtyTool } from './tools/specialty.tool';
import { ScheduleTool } from './tools/schedule.tool';
import { BookingTool } from './tools/booking.tool';
import { DoctorTool } from './tools/doctor.tool';
import { MyBookingsTool } from './tools/my-bookings.tool';
import { CloudflareAdapter } from './cloudflare.adapter';
import { GroqAdapter } from './groq.adapter';
import { AiSessionService } from './ai-session.service';
import { GoogleGenAI } from '@google/genai';
import { Observable } from 'rxjs';
import { AiSessionOutcome, AiMessageRole } from '@prisma/client';

describe('AiService', () => {
  let service: AiService;
  let specialtyToolMock: Record<string, jest.Mock>;
  let scheduleToolMock: Record<string, jest.Mock>;
  let bookingToolMock: Record<string, jest.Mock>;
  let doctorToolMock: Record<string, jest.Mock>;
  let myBookingsToolMock: Record<string, jest.Mock>;
  let cloudflareAdapterMock: Record<string, jest.Mock>;
  let groqAdapterMock: Record<string, jest.Mock>;
  let aiSessionServiceMock: Record<string, jest.Mock>;

  let mockChat: { sendMessageStream: jest.Mock };
  let mockGenAI: { chats: { create: jest.Mock } };

  beforeEach(async () => {
    mockChat = {
      sendMessageStream: jest.fn(),
    };

    mockGenAI = {
      chats: {
        create: jest.fn().mockReturnValue(mockChat),
      },
    };

    specialtyToolMock = { execute: jest.fn() };
    scheduleToolMock = { execute: jest.fn() };
    bookingToolMock = { execute: jest.fn() };
    doctorToolMock = { execute: jest.fn() };
    myBookingsToolMock = { execute: jest.fn() };
    cloudflareAdapterMock = { processFallbackChat: jest.fn() };
    groqAdapterMock = { processFallbackChat: jest.fn() };
    aiSessionServiceMock = {
      saveMessage: jest.fn(),
      endSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AI_PROVIDER,
          useValue: [mockGenAI as unknown as GoogleGenAI],
        },
        { provide: SpecialtyTool, useValue: specialtyToolMock },
        { provide: ScheduleTool, useValue: scheduleToolMock },
        { provide: BookingTool, useValue: bookingToolMock },
        { provide: DoctorTool, useValue: doctorToolMock },
        { provide: MyBookingsTool, useValue: myBookingsToolMock },
        { provide: CloudflareAdapter, useValue: cloudflareAdapterMock },
        { provide: GroqAdapter, useValue: groqAdapterMock },
        { provide: AiSessionService, useValue: aiSessionServiceMock },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('executeTool', () => {
    it('should route getSpecialtyBySymptoms to specialtyTool', async () => {
      specialtyToolMock.execute.mockResolvedValue({ specialty: 'Thần kinh' });

      const result = await (
        service as unknown as {
          executeTool: (
            n: string,
            a: Record<string, unknown>,
            p: string,
            u?: string,
          ) => Promise<unknown>;
        }
      ).executeTool(
        'getSpecialtyBySymptoms',
        { symptoms: 'headache' },
        'patient-1',
      );

      expect(specialtyToolMock.execute).toHaveBeenCalledWith({
        symptoms: 'headache',
      });
      expect(result).toEqual({ specialty: 'Thần kinh' });
    });

    it('should route getDoctorInfo to doctorTool', async () => {
      doctorToolMock.execute.mockResolvedValue({ found: true });

      const result = await (
        service as unknown as {
          executeTool: (
            n: string,
            a: Record<string, unknown>,
            p: string,
            u?: string,
          ) => Promise<unknown>;
        }
      ).executeTool('getDoctorInfo', { doctorName: 'Dr. John' }, 'patient-1');

      expect(doctorToolMock.execute).toHaveBeenCalledWith({
        doctorName: 'Dr. John',
      });
      expect(result).toEqual({ found: true });
    });

    it('should route getAvailableSlots to scheduleTool', async () => {
      scheduleToolMock.execute.mockResolvedValue({ slots: [] });

      const result = await (
        service as unknown as {
          executeTool: (
            n: string,
            a: Record<string, unknown>,
            p: string,
            u?: string,
          ) => Promise<unknown>;
        }
      ).executeTool('getAvailableSlots', { date: '2026-07-15' }, 'patient-1');

      expect(scheduleToolMock.execute).toHaveBeenCalledWith({
        date: '2026-07-15',
      });
      expect(result).toEqual({ slots: [] });
    });

    it('should route createBookingFromChat to bookingTool', async () => {
      bookingToolMock.execute.mockResolvedValue({ bookingId: 'booking-1' });

      const result = await (
        service as unknown as {
          executeTool: (
            n: string,
            a: Record<string, unknown>,
            p: string,
            u?: string,
          ) => Promise<unknown>;
        }
      ).executeTool(
        'createBookingFromChat',
        { doctorId: 'doc-1', date: '2026-07-15', startTime: '08:00' },
        'patient-1',
        'user-1',
      );

      expect(bookingToolMock.execute).toHaveBeenCalledWith({
        doctorId: 'doc-1',
        date: '2026-07-15',
        startTime: '08:00',
        patientProfileId: 'patient-1',
        userId: 'user-1',
      });
      expect(result).toEqual({ bookingId: 'booking-1' });
    });

    it('should route getMyBookings to myBookingsTool', async () => {
      myBookingsToolMock.execute.mockResolvedValue({ bookings: [] });

      const result = await (
        service as unknown as {
          executeTool: (
            n: string,
            a: Record<string, unknown>,
            p: string,
            u?: string,
          ) => Promise<unknown>;
        }
      ).executeTool('getMyBookings', { includeAll: true }, 'patient-1');

      expect(myBookingsToolMock.execute).toHaveBeenCalledWith({
        patientProfileId: 'patient-1',
        includeAll: true,
      });
      expect(result).toEqual({ bookings: [] });
    });

    it('should return error if tool name is unknown', async () => {
      const result = await (
        service as unknown as {
          executeTool: (
            n: string,
            a: Record<string, unknown>,
            p: string,
            u?: string,
          ) => Promise<unknown>;
        }
      ).executeTool('unknownTool', {}, 'patient-1');

      expect(result).toEqual({ error: 'Tool unknownTool not found' });
    });
  });

  describe('chatStream', () => {
    it('should process chat successfully with Gemini', (done) => {
      const chunk1 = { text: 'Hello' };
      const chunk2 = { text: ' world!' };

      // Mock generator for stream chunk iteration
      function* generateChunks() {
        yield chunk1;
        yield chunk2;
      }

      mockChat.sendMessageStream.mockResolvedValue(generateChunks());

      const stream = service.chatStream(
        [],
        'hi',
        'patient-1',
        'user-1',
        'session-1',
      );

      expect(stream).toBeInstanceOf(Observable);

      const received: string[] = [];
      stream.subscribe({
        next: (val) => {
          const v = val as { data?: { text?: string } };
          if (v.data?.text) {
            received.push(v.data.text);
          }
        },
        complete: () => {
          expect(received).toEqual(['Hello', ' world!']);
          expect(aiSessionServiceMock.saveMessage).toHaveBeenCalledWith(
            'session-1',
            AiMessageRole.USER,
            'hi',
          );
          expect(aiSessionServiceMock.saveMessage).toHaveBeenCalledWith(
            'session-1',
            AiMessageRole.MODEL,
            'Hello world!',
          );
          done();
          return;
        },
        error: (err: unknown) => {
          done(err);
          return;
        },
      });
    });

    it('should handle tool execution loops inside chat turns', (done) => {
      function* turn1Chunks() {
        yield {
          functionCalls: [
            {
              name: 'getSpecialtyBySymptoms',
              args: { symptoms: 'headache' },
            },
          ],
        };
      }

      function* turn2Chunks() {
        yield { text: 'Suggested specialty is neurology.' };
      }

      mockChat.sendMessageStream
        .mockResolvedValueOnce(turn1Chunks())
        .mockResolvedValueOnce(turn2Chunks());

      specialtyToolMock.execute.mockResolvedValue({ specialty: 'Neurology' });

      const stream = service.chatStream(
        [],
        'headache',
        'patient-1',
        'user-1',
        'session-1',
      );

      const received: string[] = [];
      stream.subscribe({
        next: (val) => {
          const v = val as { data?: { text?: string } };
          if (v.data?.text) {
            received.push(v.data.text);
          }
        },
        complete: () => {
          expect(specialtyToolMock.execute).toHaveBeenCalled();
          expect(received).toEqual(['Suggested specialty is neurology.']);
          expect(aiSessionServiceMock.saveMessage).toHaveBeenCalledWith(
            'session-1',
            AiMessageRole.TOOL,
            JSON.stringify({ specialty: 'Neurology' }),
            expect.objectContaining({
              toolName: 'getSpecialtyBySymptoms',
            }),
          );
          done();
        },
        error: (err: unknown) => {
          done(err);
          return;
        },
      });
    });

    it('should retry with another instance on transient error, then fallback to Groq if retry fails', (done) => {
      const transientError = { status: 503, message: 'Service Unavailable' };
      mockChat.sendMessageStream.mockRejectedValue(transientError);

      groqAdapterMock.processFallbackChat.mockImplementation(
        (history: unknown, msg: string, sub: Record<string, jest.Mock>) => {
          sub.next({ data: { text: 'Hello from Groq' } });
          sub.complete();
          return Promise.resolve();
        },
      );

      const stream = service.chatStream(
        [],
        'hi',
        'patient-1',
        'user-1',
        'session-1',
      );

      stream.subscribe({
        next: (val) => {
          const v = val as { data?: { text?: string } };
          expect(v.data?.text).toBe('Hello from Groq');
        },
        complete: () => {
          expect(groqAdapterMock.processFallbackChat).toHaveBeenCalled();
          done();
          return;
        },
        error: (err: unknown) => {
          done(err);
          return;
        },
      });
    });

    it('should fallback to Cloudflare if Groq fallback also fails', (done) => {
      const transientError = { status: 503, message: 'Service Unavailable' };
      mockChat.sendMessageStream.mockRejectedValue(transientError);

      groqAdapterMock.processFallbackChat.mockRejectedValue(
        new Error('Groq offline'),
      );
      cloudflareAdapterMock.processFallbackChat.mockImplementation(
        (history: unknown, msg: string, sub: Record<string, jest.Mock>) => {
          sub.next({ data: { text: 'Hello from Cloudflare' } });
          sub.complete();
          return Promise.resolve();
        },
      );

      const stream = service.chatStream(
        [],
        'hi',
        'patient-1',
        'user-1',
        'session-1',
      );

      stream.subscribe({
        next: (val) => {
          const v = val as { data?: { text?: string } };
          expect(v.data?.text).toBe('Hello from Cloudflare');
        },
        complete: () => {
          expect(cloudflareAdapterMock.processFallbackChat).toHaveBeenCalled();
          done();
          return;
        },
        error: (err: unknown) => {
          done(err);
          return;
        },
      });
    });

    it('should complete with error immediately if error is non-retryable', (done) => {
      const fatalError = { status: 400, message: 'Bad Request' };
      mockChat.sendMessageStream.mockRejectedValue(fatalError);

      const stream = service.chatStream(
        [],
        'hi',
        'patient-1',
        'user-1',
        'session-1',
      );

      stream.subscribe({
        next: () => {
          done(new Error('Should not push content'));
          return;
        },
        complete: () => {
          done(new Error('Should not complete successfully'));
          return;
        },
        error: (err: unknown) => {
          expect(err).toEqual(fatalError);
          done();
          return;
        },
      });
    });
  });

  describe('processCustomToolSideEffects', () => {
    it('should stream slotsData if getAvailableSlots tool returns active slots', () => {
      const mockSubscriber = { next: jest.fn() };
      const toolResult = {
        slots: [{ id: 'slot-1' }],
        metadata: { isFallback: false },
      };

      (
        service as unknown as {
          processCustomToolSideEffects: (
            name: string,
            result: Record<string, unknown>,
            sessId: string,
            sub: unknown,
          ) => void;
        }
      ).processCustomToolSideEffects(
        'getAvailableSlots',
        toolResult,
        'session-1',
        mockSubscriber,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith({
        slotsData: toolResult.slots,
        metadata: toolResult.metadata,
      });
    });

    it('should map doctor info with upcoming slots to slotsData and stream it', () => {
      const mockSubscriber = { next: jest.fn() };
      const toolResult = {
        found: true,
        doctors: [
          {
            doctorId: 'doc-1',
            fullName: 'Dr. John',
            specialties: ['Tim mạch'],
            services: [{ serviceId: 'service-1' }],
            upcomingSlots: [
              {
                slotId: 'slot-1',
                date: '2026-07-15',
                startTime: '09:00',
                endTime: '09:30',
              },
            ],
          },
        ],
      };

      (
        service as unknown as {
          processCustomToolSideEffects: (
            name: string,
            result: Record<string, unknown>,
            sessId: string,
            sub: unknown,
          ) => void;
        }
      ).processCustomToolSideEffects(
        'getDoctorInfo',
        toolResult,
        'session-1',
        mockSubscriber,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith({
        slotsData: [
          expect.objectContaining({
            slotId: 'slot-1',
            doctorId: 'doc-1',
            doctorName: 'Dr. John',
            serviceId: 'service-1',
          }),
        ],
      });
    });

    it('should trigger session end if createBookingFromChat returns bookingId', () => {
      const mockSubscriber = { next: jest.fn() };
      const toolResult = { bookingId: 'booking-1', status: 'success' };

      (
        service as unknown as {
          processCustomToolSideEffects: (
            name: string,
            result: Record<string, unknown>,
            sessId: string,
            sub: unknown,
          ) => void;
        }
      ).processCustomToolSideEffects(
        'createBookingFromChat',
        toolResult,
        'session-1',
        mockSubscriber,
      );

      expect(aiSessionServiceMock.endSession).toHaveBeenCalledWith(
        'session-1',
        AiSessionOutcome.BOOKING_MADE,
        'booking-1',
      );
    });
  });
});
