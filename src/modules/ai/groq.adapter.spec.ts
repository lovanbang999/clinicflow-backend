import { GroqAdapter } from './groq.adapter';
import { Subscriber } from 'rxjs';

describe('GroqAdapter', () => {
  let adapter: GroqAdapter;
  let mockSubscriber: Partial<Subscriber<unknown>>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-api-key';
    adapter = new GroqAdapter();
    mockSubscriber = {
      next: jest.fn(),
      complete: jest.fn(),
    };
    global.fetch = jest.fn();
  });

  describe('processFallbackChat', () => {
    it('should throw error if GROQ_API_KEY is not configured', async () => {
      delete process.env.GROQ_API_KEY;
      const badAdapter = new GroqAdapter();

      await expect(
        badAdapter.processFallbackChat(
          [],
          'hello',
          mockSubscriber as Subscriber<unknown>,
        ),
      ).rejects.toThrow('GROQ_API_KEY not configured');
    });

    it('should complete with model response text on successful request', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hello from Groq Llama',
              },
            },
          ],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await adapter.processFallbackChat(
        [],
        'hello',
        mockSubscriber as Subscriber<unknown>,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith({
        data: { text: 'Hello from Groq Llama' },
      });
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });

    it('should handle tool calls correctly and yield final content response', async () => {
      const mockResponseWithTool = {
        ok: true,
        json: jest
          .fn()
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call-groq-1',
                      type: 'function',
                      function: {
                        name: 'getDoctorInfo',
                        arguments: '{"doctorName":"Dr. John"}',
                      },
                    },
                  ],
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Found Dr. John',
                },
              },
            ],
          }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponseWithTool);

      const mockExecuteTool = jest
        .fn()
        .mockResolvedValue({ status: 'success', data: 'Dr. John' });

      await adapter.processFallbackChat(
        [],
        'Find doctor John',
        mockSubscriber as Subscriber<unknown>,
        mockExecuteTool,
      );

      expect(mockExecuteTool).toHaveBeenCalled();
      expect(mockSubscriber.next).toHaveBeenCalledWith({
        data: { text: 'Found Dr. John' },
      });
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });

    it('should throw error when api fetch fails', async () => {
      const mockFailedResponse = {
        ok: false,
        status: 500,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockFailedResponse);

      await expect(
        adapter.processFallbackChat(
          [],
          'hello',
          mockSubscriber as Subscriber<unknown>,
        ),
      ).rejects.toThrow('Groq API error: 500');
    });
  });
});
