import { Injectable, Logger } from '@nestjs/common';
import { Subscriber } from 'rxjs';
import { GEMINI_SYSTEM_PROMPT } from './ai.provider';
import {
  OpenAiMessage,
  OpenAiToolCall,
  ToolExecutorFn,
  CloudflareTool,
  convertToCloudflareTools,
  handleToolCalls,
} from './ai-fallback.utils';

@Injectable()
export class CloudflareAdapter {
  private readonly logger = new Logger(CloudflareAdapter.name);
  private readonly accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  private readonly apiToken = process.env.CLOUDFLARE_API_TOKEN;
  private readonly model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

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
    if (!this.accountId || !this.apiToken) {
      this.logger.warn('Cloudflare credentials not configured.');
      subscriber.next({
        data: {
          text: 'Hệ thống AI hiện đang xử lý quá nhiều yêu cầu. Vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp tổng đài.',
        },
      });
      subscriber.complete();
      return;
    }

    try {
      this.logger.log('Fallback to Cloudflare AI...');

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

      const tools = executeTool ? convertToCloudflareTools() : undefined;
      const MAX_TOOL_TURNS = 6;

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        let data: {
          result?: { response?: string; tool_calls?: OpenAiToolCall[] };
        };
        try {
          data = await this.callCloudflare(messages, tools);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('400') && tools && tools.length > 0) {
            this.logger.warn(
              'Cloudflare 400 with tools — retrying without tools',
            );
            data = await this.callCloudflare(messages, undefined);
          } else {
            throw err;
          }
        }

        const toolCalls = data.result?.tool_calls;
        const text = data.result?.response ?? '';

        if (toolCalls && toolCalls.length > 0 && executeTool) {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCalls,
          });

          await handleToolCalls(
            toolCalls,
            executeTool,
            patientId ?? '',
            userId,
            messages,
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
    } catch (error) {
      this.logger.error('Cloudflare fallback failed:', error);
      subscriber.next({
        data: {
          text: 'Hệ thống tư vấn tự động hiện đang bảo trì. Vui lòng để lại số điện thoại để trung tâm tư vấn trực tiếp.',
        },
      });
      subscriber.complete();
    }
  }

  private async callCloudflare(
    messages: OpenAiMessage[],
    tools?: CloudflareTool[],
  ): Promise<{
    result?: { response?: string; tool_calls?: OpenAiToolCall[] };
  }> {
    const body: Record<string, unknown> = { messages };
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status}`);
    }

    return response.json() as Promise<{
      result?: { response?: string; tool_calls?: OpenAiToolCall[] };
    }>;
  }
}
