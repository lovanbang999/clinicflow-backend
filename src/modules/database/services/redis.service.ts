import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { REDIS_CLIENT, type IRedisClient } from '../redis.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger('RedisService');

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: IRedisClient,
  ) {}

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  /**
   * Helper to check if Redis is currently connected and ready.
   */
  isReady(): boolean {
    return this.redisClient.status === 'ready';
  }

  async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      return null;
    }
    try {
      return await this.redisClient.get(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis GET failed for key "${key}": ${message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    try {
      if (ttlSeconds) {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis SET failed for key "${key}": ${message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    try {
      await this.redisClient.del(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis DEL failed for key "${key}": ${message}`);
    }
  }

  /**
   * Production-safe pattern eviction using SCAN
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    try {
      let cursor = '0';
      do {
        const reply = await this.redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = reply[0];
        const keys = reply[1];
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Redis delPattern failed for pattern "${pattern}": ${message}`,
      );
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.isReady()) {
      return null;
    }
    try {
      return await this.redisClient.incr(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis INCR failed for key "${key}": ${message}`);
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<number | null> {
    if (!this.isReady()) {
      return null;
    }
    try {
      return await this.redisClient.expire(key, seconds);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis EXPIRE failed for key "${key}": ${message}`);
      return null;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data) as T;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to parse JSON for Redis key "${key}": ${message}`,
      );
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      await this.set(key, JSON.stringify(value), ttlSeconds);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to serialize JSON for Redis key "${key}": ${message}`,
      );
    }
  }
}
