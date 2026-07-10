import { CloudflareAdapter } from './cloudflare.adapter';
import { Subscriber } from 'rxjs';

describe('CloudflareAdapter', () => {
  let adapter: CloudflareAdapter;
  let mockSubscriber: Partial<Subscriber<unknown>>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';
    adapter = new CloudflareAdapter();
    mockSubscriber = {
      next: jest.fn(),
      complete: jest.fn(),
    };
    global.fetch = jest.fn();
  });

  describe('processFallbackChat', () => {
    it('should push a default maintenance message if credentials are missing', async () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_API_TOKEN;
      // Re-instantiate to pickup env change
      const badAdapter = new CloudflareAdapter();

      await badAdapter.processFallbackChat(
        [],
        'hello',
        mockSubscriber as Subscriber<unknown>,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: expect.stringContaining(
              'Hệ thống AI hiện đang xử lý quá nhiều yêu cầu',
            ) as string,
          }) as unknown,
        }),
      );
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });

    it('should complete with model response text on successful request', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: { response: 'Hello from Llama' },
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await adapter.processFallbackChat(
        [],
        'hello',
        mockSubscriber as Subscriber<unknown>,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith({
        data: { text: 'Hello from Llama' },
      });
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });

    it('should handle tool calls correctly if executeTool is provided', async () => {
      const mockResponseWithTool = {
        ok: true,
        json: jest
          .fn()
          .mockResolvedValueOnce({
            result: {
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'getDoctorInfo',
                    arguments: JSON.stringify({ doctorName: 'Dr. John' }),
                  },
                },
              ],
            },
          })
          .mockResolvedValueOnce({
            result: { response: 'Here is the doctor info' },
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
        data: { text: 'Here is the doctor info' },
      });
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });

    it('should retry without tools if a 400 is returned', async () => {
      // First call fails with 400
      const mockResponse400 = {
        ok: false,
        status: 400,
      };
      const mockResponseSuccess = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: { response: 'Retried successfully' },
        }),
      };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockResponse400)
        .mockResolvedValueOnce(mockResponseSuccess);

      const mockExecuteTool = jest.fn();

      await adapter.processFallbackChat(
        [],
        'symptoms',
        mockSubscriber as Subscriber<unknown>,
        mockExecuteTool,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith({
        data: { text: 'Retried successfully' },
      });
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });

    it('should push error maintenance message if API call fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Cloudflare network crash'),
      );

      await adapter.processFallbackChat(
        [],
        'hello',
        mockSubscriber as Subscriber<unknown>,
      );

      expect(mockSubscriber.next).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: expect.stringContaining(
              'Hệ thống tư vấn tự động hiện đang bảo trì',
            ) as string,
          }) as unknown,
        }),
      );
      expect(mockSubscriber.complete).toHaveBeenCalled();
    });
  });
});
