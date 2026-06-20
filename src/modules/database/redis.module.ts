import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Interface for the Redis client operations used across the app.
 * Decouples consumers from the ioredis implementation.
 */
export interface IRedisClient {
  readonly status: string;
  disconnect(): void;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'connect', listener: () => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    ex: 'EX',
    seconds: number,
  ): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: string,
    match: 'MATCH',
    pattern: string,
    count: 'COUNT',
    countValue: number,
  ): Promise<[string, string[]]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): IRedisClient => {
        const logger = new Logger('RedisModule');
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD');
        const db = configService.get<number>('REDIS_DB', 0);

        logger.log(
          `Initializing Redis client connecting to ${host}:${port} (db: ${db})...`,
        );

        const options: RedisOptions = {
          host,
          port,
          db,
          maxRetriesPerRequest: null,
          // Prevent standard start error crashes - retry indefinitely in background
          retryStrategy(times: number): number {
            return Math.min(times * 100, 3000);
          },
        };

        if (password) {
          options.password = password;
        }

        const redis = new Redis(options);

        // CRITICAL: Prevent unhandled error event crashes in Node.js when Redis is offline!
        redis.on('error', (err: Error) => {
          logger.warn(
            `Redis connection error: ${err.message}. Gracefully degraded to PostgreSQL/MySQL fallback.`,
          );
        });

        redis.on('connect', () => {
          logger.log('Successfully connected to Redis cache server!');
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
