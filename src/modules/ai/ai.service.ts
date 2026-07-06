import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  GoogleGenAI,
  SendMessageParameters,
  FunctionCall,
  Part,
  Content,
} from '@google/genai';
import { AiSessionOutcome, AiMessageRole } from '@prisma/client';
import { Observable, Subscriber } from 'rxjs';
import {
  AI_PROVIDER,
  CHATBOT_TOOLS,
  PatientContext,
  buildSystemPrompt,
} from './ai.provider';
import { SpecialtyTool } from './tools/specialty.tool';
import { ScheduleTool } from './tools/schedule.tool';
import { BookingTool } from './tools/booking.tool';
import { DoctorTool } from './tools/doctor.tool';
import { MyBookingsTool } from './tools/my-bookings.tool';
import { CloudflareAdapter } from './cloudflare.adapter';
import { GroqAdapter } from './groq.adapter';
import { AiSessionService } from './ai-session.service';

interface DoctorSlot {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  roomName?: string;
}

interface DoctorInfoEntry {
  doctorId: string;
  fullName: string;
  specialties?: string[];
  services?: { serviceId: string }[];
  upcomingSlots?: DoctorSlot[];
}

interface DoctorInfoResult {
  found?: boolean;
  doctors?: DoctorInfoEntry[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly aiInstances: GoogleGenAI[],
    private readonly specialtyTool: SpecialtyTool,
    private readonly scheduleTool: ScheduleTool,
    private readonly bookingTool: BookingTool,
    private readonly doctorTool: DoctorTool,
    private readonly myBookingsTool: MyBookingsTool,
    private readonly cloudflareAdapter: CloudflareAdapter,
    private readonly groqAdapter: GroqAdapter,
    private readonly aiSessionService: AiSessionService,
  ) {}

  private pickAiInstance(): GoogleGenAI {
    return this.aiInstances[
      Math.floor(Math.random() * this.aiInstances.length)
    ];
  }

  private isRetryableError(err: unknown): boolean {
    const e = err as { status?: number; message?: string };
    const msg = e?.message?.toLowerCase() ?? '';
    return (
      e?.status === 503 ||
      e?.status === 429 ||
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('high demand') ||
      msg.includes('service unavailable')
    );
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    patientId: string,
    userId?: string,
  ): Promise<unknown> {
    this.logger.log(`Executing tool: ${name}`);

    const toolMap: Record<
      string,
      (args: Record<string, unknown>) => Promise<unknown>
    > = {
      getSpecialtyBySymptoms: (a) =>
        this.specialtyTool.execute(a as { symptoms: string }),
      getDoctorInfo: (a) =>
        this.doctorTool.execute(
          a as { doctorName?: string; specialtyName?: string },
        ),
      getAvailableSlots: (a) =>
        this.scheduleTool.execute(
          a as {
            serviceId?: string;
            specialtyName?: string;
            doctorId?: string;
            date?: string;
            limit?: number;
          },
        ),
      createBookingFromChat: (a) => {
        const bookingArgs = a as {
          doctorId: string;
          serviceId?: string;
          slotId?: string;
          date: string;
          startTime: string;
          endTime?: string;
        };
        return this.bookingTool.execute({
          ...bookingArgs,
          patientProfileId: patientId,
          userId: userId!,
        });
      },
      getMyBookings: (a) =>
        this.myBookingsTool.execute({
          patientProfileId: patientId,
          includeAll: !!a.includeAll,
        }),
    };

    const executor = toolMap[name];
    if (executor) {
      return executor(args);
    }

    return { error: `Tool ${name} not found` };
  }

  chatStream(
    historyMessages: unknown[],
    userMessage: string,
    patientId: string,
    userId: string,
    sessionId: string,
    patientContext?: PatientContext,
  ): Observable<unknown> {
    return new Observable((subscriber: Subscriber<unknown>) => {
      this.processChat(
        historyMessages,
        userMessage,
        patientId,
        userId,
        sessionId,
        subscriber,
        patientContext,
      ).catch(async (err) => {
        if (!this.isRetryableError(err)) {
          this.logger.error('Chat error:', err);
          subscriber.error(err);
          return;
        }

        this.logger.warn(
          `Gemini failed (${(err as { status?: number })?.status ?? 'unknown'}). Retrying with alternate key...`,
        );
        await new Promise((r) => setTimeout(r, 1500));

        try {
          await this.processChat(
            historyMessages,
            userMessage,
            patientId,
            userId,
            sessionId,
            subscriber,
            patientContext,
          );
        } catch {
          const fallbackArgs = [
            historyMessages as Array<{
              role?: string;
              parts?: Array<{ text?: string }>;
              content?: string;
            }>,
            userMessage,
            subscriber,
            (
              name: string,
              args: Record<string, unknown>,
              pid: string,
              uid?: string,
            ) => this.executeTool(name, args, pid, uid),
            patientId,
            userId,
          ] as const;

          try {
            this.logger.warn('Retry failed. Trying Groq fallback...');
            await this.groqAdapter.processFallbackChat(...fallbackArgs);
          } catch (groqErr) {
            this.logger.warn(
              `Groq failed (${(groqErr as Error).message}). Triggering Cloudflare fallback...`,
            );
            await this.cloudflareAdapter.processFallbackChat(...fallbackArgs);
          }
        }
      });
    });
  }

  private async processChat(
    historyMessages: unknown[],
    userMessage: string,
    patientId: string,
    userId: string,
    sessionId: string,
    subscriber: Subscriber<unknown>,
    patientContext?: PatientContext,
  ) {
    void this.aiSessionService.saveMessage(
      sessionId,
      AiMessageRole.USER,
      userMessage,
    );

    const systemInstruction = buildSystemPrompt(patientContext);

    const chat = this.pickAiInstance().chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction,
        tools: CHATBOT_TOOLS,
      },
      history: historyMessages as Content[],
    });

    let messageToProcess: SendMessageParameters = {
      message: userMessage,
    };
    let hasMoreTurns = true;
    let turnCount = 0;
    const MAX_TURNS = 8;
    let fullModelText = '';

    while (hasMoreTurns) {
      if (++turnCount > MAX_TURNS) {
        this.logger.warn(
          `processChat exceeded ${MAX_TURNS} turns — forcing completion`,
        );
        const maxTurnsMsg =
          '\n\nXin lỗi, tôi không thể xử lý yêu cầu này. Vui lòng thử lại hoặc đặt câu hỏi cụ thể hơn.';
        subscriber.next({ data: { text: maxTurnsMsg } });
        fullModelText += maxTurnsMsg;
        break;
      }
      const responseStream = await chat.sendMessageStream(messageToProcess);
      const functionCallsInTurn: FunctionCall[] = [];
      let turnText = '';

      for await (const chunk of responseStream) {
        if (chunk.text) {
          subscriber.next({ data: { text: chunk.text } });
          turnText += chunk.text;
        }
        if (chunk.functionCalls) {
          functionCallsInTurn.push(...chunk.functionCalls);
        }
      }

      if (turnText) {
        fullModelText += turnText;
      }

      if (functionCallsInTurn.length > 0) {
        const toolResults = await Promise.all(
          functionCallsInTurn.map(async (call) => {
            const rawResult = await this.executeTool(
              call.name || '',
              call.args || {},
              patientId,
              userId,
            );

            const result = this.sanitizeToolResult(rawResult);
            const toolResult = result as Record<string, unknown>;
            void this.aiSessionService.saveMessage(
              sessionId,
              AiMessageRole.TOOL,
              JSON.stringify(toolResult),
              {
                toolName: call.name,
                toolInput: call.args || {},
                toolOutput: toolResult,
              },
            );

            if (call.name === 'getAvailableSlots') {
              const r = toolResult as { slots?: unknown[]; metadata?: unknown };
              if (r?.slots && Array.isArray(r.slots) && r.slots.length > 0) {
                subscriber.next({ slotsData: r.slots, metadata: r.metadata });
              }
            }

            if (call.name === 'getDoctorInfo') {
              const r = toolResult as DoctorInfoResult;
              if (r?.found && r.doctors && r.doctors.length > 0) {
                const slots = r.doctors.flatMap((d) => {
                  const serviceId =
                    d.services && d.services.length > 0
                      ? d.services[0].serviceId
                      : 'unknown';

                  return (d.upcomingSlots || []).map((s) => ({
                    ...s,
                    doctorId: d.doctorId,
                    doctorName: d.fullName,
                    specialties: d.specialties,
                    serviceId,
                  }));
                });
                if (slots.length > 0) {
                  subscriber.next({ slotsData: slots });
                }
              }
            }

            const r = result as { bookingId?: string; status?: string };
            if (call.name === 'createBookingFromChat' && r?.bookingId) {
              void this.aiSessionService.endSession(
                sessionId,
                AiSessionOutcome.BOOKING_MADE,
                r.bookingId,
              );
            }
            return {
              functionResponse: {
                name: call.name,
                response: { result },
              },
            };
          }),
        );
        messageToProcess = { message: toolResults as Part[] };
      } else {
        hasMoreTurns = false;
      }
    }

    if (fullModelText) {
      void this.aiSessionService.saveMessage(
        sessionId,
        AiMessageRole.MODEL,
        fullModelText,
      );
    }

    subscriber.complete();
  }

  private sanitizeToolResult(result: unknown): unknown {
    if (!result) return result;
    try {
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Failed to sanitize tool result:', error);
      return result;
    }
  }
}
