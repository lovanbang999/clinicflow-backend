import { CHATBOT_TOOLS } from './ai.provider';

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

export type CloudflareTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/**
 * Helper to recursively convert a GenAI Type schema definition into
 * a standard JSON Schema structure required by OpenAI-compatible APIs.
 */
export function convertSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }
  const s = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (s.type) {
    result.type = (s.type as string).toLowerCase();
  }
  if (s.description) {
    result.description = s.description;
  }
  if (s.required) {
    result.required = s.required;
  }
  if (s.enum) {
    result.enum = s.enum;
  }

  if (s.properties && typeof s.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      s.properties as Record<string, unknown>,
    )) {
      props[key] = convertSchema(val);
    }
    result.properties = props;
  }

  if (s.items) {
    result.items = convertSchema(s.items);
  }
  return result;
}

/**
 * Converts Google GenAI tool declarations to standard OpenAI Tool format.
 */
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

/**
 * Converts Google GenAI tool declarations to Cloudflare specific Tool format.
 */
export function convertToCloudflareTools(): CloudflareTool[] {
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

/**
 * Executes a list of tool calls triggered by the LLM, logs input/output,
 * and appends the result messages back into the message history.
 */
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
        // Ignored parsing failures
      }

      let result: unknown;
      try {
        result = await executeTool(tc.function.name, args, patientId, userId);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }),
  );
}
