import { Injectable, Logger } from '@nestjs/common';
import { Subscriber } from 'rxjs';
import { GEMINI_SYSTEM_PROMPT } from './ai.provider';

@Injectable()
export class CloudflareAdapter {
  private readonly logger = new Logger(CloudflareAdapter.name);
  private readonly accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  private readonly apiToken = process.env.CLOUDFLARE_API_TOKEN;

  async processFallbackChat(
    historyMessages: Array<{
      role?: string;
      parts?: Array<{ text?: string }>;
      content?: string;
    }>,
    userMessage: string,
    subscriber: Subscriber<any>,
  ) {
    if (!this.accountId || !this.apiToken) {
      this.logger.warn(
        'Cloudflare credentials not configured. Cannot use fallback.',
      );

      // Send a polite fallback message since both primary and secondary AI are unavailable.
      subscriber.next({
        data: {
          text: 'Hệ thống AI hiện đang xử lý quá nhiều yêu cầu. Vui lòng trở lại sau ít phút hoặc liên hệ trực tiếp tổng đài chăm sóc khách hàng.',
        },
      });
      subscriber.complete();
      return;
    }

    try {
      this.logger.log('Fallback to Cloudflare AI...');

      // 1. Map history to standard chat completions format (Llama style context)
      const messages = [
        {
          role: 'system',
          content:
            GEMINI_SYSTEM_PROMPT +
            '\nLưu ý: Hiện tại hệ thống đặt lịch tự động đang bảo trì, chỉ cung cấp tư vấn y tế hoặc yêu cầu bệnh nhân để lại số điện thoại.',
        },
      ];

      for (const msg of historyMessages) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts?.[0]?.text || msg.content || '',
        });
      }

      messages.push({ role: 'user', content: userMessage });

      // 2. Call Cloudflare Workers AI
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages }),
        },
      );

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        result?: { response?: string };
      };
      const text =
        data.result?.response ||
        'Xin lỗi, hiện tại tôi không thể xử lý yêu cầu của bạn, vui lòng liên hệ lễ tân.';

      // 3. Yield the response
      subscriber.next({
        data: { text: `${text}` },
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
}
