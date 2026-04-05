import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  GoogleGenAI,
  SendMessageParameters,
  FunctionCall,
} from '@google/genai';
import {
  AI_PROVIDER,
  GEMINI_SYSTEM_PROMPT,
  CHATBOT_TOOLS,
} from './ai.provider';
import { SpecialtyTool } from './tools/specialty.tool';
import { ScheduleTool } from './tools/schedule.tool';
import { BookingTool } from './tools/booking.tool';
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
    private readonly cloudflareAdapter: CloudflareAdapter,
    private readonly aiSessionService: AiSessionService,
  ) {}

  /**
   * Handles tool call execution mapping
   */
  async executeTool(name: string, args: any, patientId: string) {
    this.logger.log(`Executing tool: ${name}`);
    if (name === 'getSpecialtyBySymptoms') {
      return this.specialtyTool.execute(args as { symptoms: string });
    } else if (name === 'getAvailableSlots') {
      return this.scheduleTool.execute(
        args as {
          serviceId?: string;
          specialtyName?: string;
          date?: string;
          limit?: number;
        },
      );
    } else if (name === 'createBookingFromChat') {
      return this.bookingTool.execute({
        ...args,
        patientProfileId: patientId,
      } as {
        patientProfileId: string;
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
   */
  chatStream(
    historyMessages: any[],
    userMessage: string,
    patientId: string,
    sessionId: string,
  ): Observable<any> {
    return new Observable((subscriber) => {
      this.processChat(
        historyMessages,
        userMessage,
        patientId,
        sessionId,
        subscriber,
      ).catch(async (err) => {
        const errorProxy = err as {
          status?: number;
          message?: string;
          [key: string]: unknown;
        };
        if (
          errorProxy?.status === 429 ||
          errorProxy?.message?.includes('429')
        ) {
          this.logger.warn(
            'Gemini quota exceeded. Triggering Cloudflare fallback...',
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
    historyMessages: any[],
    userMessage: string,
    patientId: string,
    sessionId: string,
    subscriber: Subscriber<any>,
  ) {
    // Persist the user message first (fire-and-forget, non-blocking)
    void this.aiSessionService.saveMessage(
      sessionId,
      AiMessageRole.USER,
      userMessage,
    );

    const chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: GEMINI_SYSTEM_PROMPT,
        tools: CHATBOT_TOOLS,
      },
      history: historyMessages,
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
            const result = await this.executeTool(
              call.name || '',
              call.args,
              patientId,
            );

            // Persist tool call message with result
            const toolResult = result as Record<string, unknown>;
            void this.aiSessionService.saveMessage(
              sessionId,
              AiMessageRole.TOOL,
              JSON.stringify(toolResult),
              {
                toolName: call.name,
                toolInput: call.args as Record<string, unknown>,
                toolOutput: toolResult,
              },
            );

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
        messageToProcess = { message: toolResults };
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
}
