import { Injectable, Logger } from '@nestjs/common';
import { Subscriber } from 'rxjs';
import { GEMINI_SYSTEM_PROMPT, CHATBOT_TOOLS } from './ai.provider';

export type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type OpenAiMessage = {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
};

export type ToolExecutorFn = (
  name: string,
  args: Record<string, unknown>,
  patientId: string,
  userId?: string,
) => Promise<unknown>;

export function convertToOpenAiTools(): OpenAiTool[] {
  const declarations = CHATBOT_TOOLS[0]?.functionDeclarations ?? [];
  return (
    declarations as Array<{
      name: string;
      description?: string;
      parameters?: unknown;
    }>
  ).map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description ?? '',
      parameters: convertSchema(fn.parameters),
    },
  }));
}

type CloudflareTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

function convertToCloudflareTools(): CloudflareTool[] {
  const declarations = CHATBOT_TOOLS[0]?.functionDeclarations ?? [];
  return (
    declarations as Array<{
      name: string;
      description?: string;
      parameters?: unknown;
    }>
  ).map((fn) => ({
    name: fn.name,
    description: fn.description ?? '',
    parameters: convertSchema(fn.parameters),
  }));
}

function convertSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object')
    return { type: 'object', properties: {} };
  const s = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (s.type) result.type = (s.type as string).toLowerCase();
  if (s.description) result.description = s.description;
  if (s.required) result.required = s.required;
  if (s.enum) result.enum = s.enum;

  if (s.properties && typeof s.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      s.properties as Record<string, unknown>,
    )) {
      props[key] = convertSchema(val);
    }
    result.properties = props;
  }

  if (s.items) result.items = convertSchema(s.items);
  return result;
}

export async function handleToolCalls(
  toolCalls: OpenAiToolCall[],
  executeTool: ToolExecutorFn,
  patientId: string,
  userId: string | undefined,
  messages: OpenAiMessage[],
): Promise<void> {
  await Promise.all(
    toolCalls.map(async (tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // Ignored
      }

      let result: unknown;
      try {
        result = await executeTool(tc.function.name, args, patientId, userId);
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
}

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
  ) {
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
          const msg = (err as Error).message ?? '';
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
        const text: string = data.result?.response ?? '';

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
    if (tools && tools.length > 0) body.tools = tools;

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
