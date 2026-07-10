import {
  convertSchema,
  convertToOpenAiTools,
  convertToCloudflareTools,
  handleToolCalls,
  OpenAiToolCall,
  OpenAiMessage,
} from './ai-fallback.utils';

describe('AiFallbackUtils', () => {
  describe('convertSchema', () => {
    it('should return default object structure if schema is null or not an object', () => {
      expect(convertSchema(null)).toEqual({ type: 'object', properties: {} });
      expect(convertSchema(undefined)).toEqual({
        type: 'object',
        properties: {},
      });
      expect(convertSchema('string')).toEqual({
        type: 'object',
        properties: {},
      });
    });

    it('should convert standard properties recursively', () => {
      const gcpSchema = {
        type: 'OBJECT',
        description: 'Test schema',
        required: ['name'],
        properties: {
          name: { type: 'STRING', description: 'Name parameter' },
          age: { type: 'INTEGER', enum: [10, 20] },
          tags: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
      };

      const result = convertSchema(gcpSchema);

      expect(result).toEqual({
        type: 'object',
        description: 'Test schema',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Name parameter' },
          age: { type: 'integer', enum: [10, 20] },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      });
    });
  });

  describe('convertToOpenAiTools', () => {
    it('should convert CHATBOT_TOOLS to OpenAI Tool format', () => {
      const tools = convertToOpenAiTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty('type', 'function');
      expect(tools[0].function).toHaveProperty('name');
      expect(tools[0].function).toHaveProperty('description');
      expect(tools[0].function).toHaveProperty('parameters');
    });
  });

  describe('convertToCloudflareTools', () => {
    it('should convert CHATBOT_TOOLS to Cloudflare Tool format', () => {
      const tools = convertToCloudflareTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).not.toHaveProperty('type');
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('description');
      expect(tools[0]).toHaveProperty('parameters');
    });
  });

  describe('handleToolCalls', () => {
    it('should execute tool calls, run executeTool, and append messages', async () => {
      const toolCalls: OpenAiToolCall[] = [
        {
          id: 'call-1',
          type: 'function',
          function: {
            name: 'getDoctorInfo',
            arguments: JSON.stringify({ doctorName: 'John' }),
          },
        },
      ];

      const executeToolMock = jest
        .fn()
        .mockResolvedValue({ id: 'doc-1', name: 'Dr. John' });
      const messages: OpenAiMessage[] = [];

      await handleToolCalls(
        toolCalls,
        executeToolMock,
        'patient-123',
        'user-456',
        messages,
      );

      expect(executeToolMock).toHaveBeenCalledWith(
        'getDoctorInfo',
        { doctorName: 'John' },
        'patient-123',
        'user-456',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call-1',
        content: JSON.stringify({ id: 'doc-1', name: 'Dr. John' }),
      });
    });

    it('should catch errors thrown in executeTool and write error object to messages', async () => {
      const toolCalls: OpenAiToolCall[] = [
        {
          id: 'call-2',
          type: 'function',
          function: {
            name: 'getAvailableSlots',
            arguments: JSON.stringify({ date: '2026-07-10' }),
          },
        },
      ];

      const errorInstance = new Error('Slot full');
      const executeToolMock = jest.fn().mockRejectedValue(errorInstance);
      const messages: OpenAiMessage[] = [];

      await handleToolCalls(
        toolCalls,
        executeToolMock,
        'patient-123',
        'user-456',
        messages,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('tool');
      expect(messages[0].tool_call_id).toBe('call-2');
      expect(JSON.parse(messages[0].content || '{}')).toEqual({
        error: 'Slot full',
      });
    });
  });
});
