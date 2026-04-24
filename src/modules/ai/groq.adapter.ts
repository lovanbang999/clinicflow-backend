import { Injectable, Logger } from '@nestjs/common';
import { Subscriber } from 'rxjs';
import { GEMINI_SYSTEM_PROMPT } from './ai.provider';
import {
  ToolExecutorFn,
  OpenAiMessage,
  OpenAiTool,
  OpenAiToolCall,
  convertToOpenAiTools,
} from './cloudflare.adapter';

type GroqResponse = {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: OpenAiToolCall[];
    };
  }>;
};

@Injectable()
export class GroqAdapter {
  private readonly logger = new Logger(GroqAdapter.name);
  private readonly apiKey = process.env.GROQ_API_KEY;
  private readonly model = 'llama-3.3-70b-versatile';

  async processFallbackChat(
    historyMessages: Array<{
      role?: string;
      parts?: Array<{ text?: string }>;
      content?: string;
    }>,
    userMessage: string,
    subscriber: Subscriber<unknown>,
    executeTool?: ToolExecutorFn,
    patientId?: string,
    userId?: string,
  ): Promise<void> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    this.logger.log('Fallback to Groq AI...');

    const messages: OpenAiMessage[] = [
      { role: 'system', content: GEMINI_SYSTEM_PROMPT },
    ];

    for (const msg of historyMessages) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts?.[0]?.text ?? msg.content ?? '',
      });
    }
    messages.push({ role: 'user', content: userMessage });

    const tools = executeTool ? convertToOpenAiTools() : undefined;
    const MAX_TOOL_TURNS = 6;

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const data = await this.callGroq(messages, tools);
      const assistantMsg = data.choices?.[0]?.message;
      const toolCalls = assistantMsg?.tool_calls;
      const text = assistantMsg?.content ?? '';

      if (toolCalls && toolCalls.length > 0 && executeTool) {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        });

        await Promise.all(
          toolCalls.map(async (tc) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments) as Record<
                string,
                unknown
              >;
            } catch {
              // malformed args — proceed with empty
            }

            let result: unknown;
            try {
              result = await executeTool(
                tc.function.name,
                args,
                patientId ?? '',
                userId,
              );
            } catch (e) {
              result = { error: String(e) };
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }),
        );
      } else {
        subscriber.next({
          data: {
            text:
              text ||
              'Xin lỗi, hiện tại tôi không thể xử lý yêu cầu, vui lòng liên hệ lễ tân.',
          },
        });
        subscriber.complete();
        return;
      }
    }

    subscriber.next({
      data: {
        text: 'Xin lỗi, tôi không thể xử lý yêu cầu này. Vui lòng liên hệ lễ tân hoặc thử lại.',
      },
    });
    subscriber.complete();
  }

  private async callGroq(
    messages: OpenAiMessage[],
    tools?: OpenAiTool[],
  ): Promise<GroqResponse> {
    const body: Record<string, unknown> = { model: this.model, messages };
    if (tools && tools.length > 0) body.tools = tools;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    return response.json() as Promise<GroqResponse>;
  }
}
