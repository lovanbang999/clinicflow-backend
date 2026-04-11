import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  GoogleGenAI,
  SendMessageParameters,
  FunctionCall,
  Part,
} from '@google/genai';
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
import { CloudflareAdapter } from './cloudflare.adapter';
import { AiSessionService } from './ai-session.service';
import { AiSessionOutcome, AiMessageRole } from '@prisma/client';
import { Observable, Subscriber } from 'rxjs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly ai: GoogleGenAI,
    private readonly specialtyTool: SpecialtyTool,
    private readonly scheduleTool: ScheduleTool,
    private readonly bookingTool: BookingTool,
    private readonly doctorTool: DoctorTool,
    private readonly cloudflareAdapter: CloudflareAdapter,
    private readonly aiSessionService: AiSessionService,
  ) {}

  /**
   * Handles tool call execution mapping
   */
  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    patientId: string,
    userId?: string,
  ): Promise<unknown> {
    this.logger.log(`Executing tool: ${name}`);

    if (name === 'getSpecialtyBySymptoms') {
      return this.specialtyTool.execute(args as { symptoms: string });
    }

    if (name === 'getDoctorInfo') {
      return this.doctorTool.execute(
        args as { doctorName: string; specialtyName?: string },
      );
    }

    if (name === 'getAvailableSlots') {
      return this.scheduleTool.execute(
        args as {
          serviceId?: string;
          specialtyName?: string;
          date?: string;
          limit?: number;
        },
      );
    }

    if (name === 'createBookingFromChat') {
      return this.bookingTool.execute({
        ...args,
        patientProfileId: patientId,
        userId: userId!,
      } as {
        patientProfileId: string;
        userId: string;
        doctorId: string;
        serviceId: string;
        date: string;
        startTime: string;
      });
    }

    return { error: `Tool ${name} not found` };
  }

  /**
   * SSE Stream endpoint. Uses RxJS Observable to stream chunks.
   * Persists all messages to the session.
   * Accepts optional patientContext to build a personalized system prompt.
   */
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
        const errorProxy = err as {
          status?: number;
          message?: string;
          [key: string]: unknown;
        };
        const errorMsg = errorProxy?.message || '';
        const isQuotaExceeded =
          errorProxy?.status === 429 || errorMsg.includes('429');
        const isHighDemand =
          errorProxy?.status === 503 ||
          errorMsg.includes('503') ||
          errorMsg.toLowerCase().includes('high demand') ||
          errorMsg.toLowerCase().includes('service unavailable');

        if (isQuotaExceeded || isHighDemand) {
          this.logger.warn(
            `Gemini ${isQuotaExceeded ? 'Quota Exceeded' : 'High Demand (503)'}. Triggering Cloudflare fallback...`,
          );
          await this.cloudflareAdapter.processFallbackChat(
            historyMessages as Array<{
              role?: string;
              parts?: Array<{ text?: string }>;
              content?: string;
            }>,
            userMessage,
            subscriber,
          );
        } else {
          this.logger.error('Chat error:', err);
          subscriber.error(err);
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
    // Persist the user message first (fire-and-forget, non-blocking)
    void this.aiSessionService.saveMessage(
      sessionId,
      AiMessageRole.USER,
      userMessage,
    );

    // Build a personalized system prompt with patient context + current time
    const systemInstruction = buildSystemPrompt(patientContext);

    const chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
        tools: CHATBOT_TOOLS,
      },
      history: historyMessages as any[],
    });

    let messageToProcess: SendMessageParameters = {
      message: userMessage,
    };
    let hasMoreTurns = true;
    let fullModelText = ''; // Accumulates the complete AI response for persistence

    while (hasMoreTurns) {
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
            console.log(`[AiService] TOOL EXECUTION: ${call.name}`, call.args);
            const rawResult = await this.executeTool(
              call.name || '',
              call.args || {},
              patientId,
              userId,
            );

            // Sanitize result to remove non-serializable objects (like Prisma Decimals)
            const result = this.sanitizeToolResult(rawResult);

            // Persist tool call message with result
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

            // Emit structured slots data for the frontend SlotPicker
            if (call.name === 'getAvailableSlots') {
              const r = toolResult as { slots?: unknown[]; metadata?: unknown };
              if (r?.slots && Array.isArray(r.slots) && r.slots.length > 0) {
                subscriber.next({ slotsData: r.slots, metadata: r.metadata });
              }
            }

            // Emit doctor info with slots for SlotPicker
            if (call.name === 'getDoctorInfo') {
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
              const r = toolResult as DoctorInfoResult;
              if (r?.found && r.doctors && r.doctors.length > 0) {
                const slots = r.doctors.flatMap((d) => {
                  // Fallback to the first available service ID, required for online bookings
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

            // If booking was just created, mark session as BOOKING_MADE
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

    // Persist the complete model response
    if (fullModelText) {
      void this.aiSessionService.saveMessage(
        sessionId,
        AiMessageRole.MODEL,
        fullModelText,
      );
    }

    subscriber.complete();
  }

  /**
   * Deeply cleans tool results to ensure they are plain JSON objects.
   * Specifically converts Prisma Decimal objects to numbers/strings
   * and ensures no functions or non-clonable classes remain.
   */
  private sanitizeToolResult(result: unknown): unknown {
    if (!result) return result;
    try {
      // Simple but effective: pipe through JSON to strip functions and convert Decimals to strings/numbers
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Failed to sanitize tool result:', error);
      return result;
    }
  }
}
