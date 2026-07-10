import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from '../redis.module';

describe('RedisService', () => {
  let service: RedisService;
  let redisClientMock: Record<string, jest.Mock | string>;

  beforeEach(async () => {
    redisClientMock = {
      status: 'ready',
      disconnect: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: REDIS_CLIENT, useValue: redisClientMock },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  describe('onModuleDestroy', () => {
    it('should disconnect redis client', () => {
      service.onModuleDestroy();
      expect(redisClientMock.disconnect).toHaveBeenCalled();
    });
  });

  describe('isReady', () => {
    it('should return true if status is ready', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should return false if status is not ready', () => {
      redisClientMock.status = 'connecting';
      expect(service.isReady()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return null if redis is not ready', async () => {
      redisClientMock.status = 'connecting';
      const res = await service.get('key');
      expect(res).toBeNull();
    });

    it('should query redis client get successfully', async () => {
      (redisClientMock.get as jest.Mock).mockResolvedValue('val');
      const res = await service.get('key');
      expect(redisClientMock.get).toHaveBeenCalledWith('key');
      expect(res).toBe('val');
    });

    it('should catch error and return null if redis client get throws', async () => {
      (redisClientMock.get as jest.Mock).mockRejectedValue(
        new Error('Redis crash'),
      );
      const res = await service.get('key');
      expect(res).toBeNull();
    });
  });

  describe('set', () => {
    it('should return immediately if redis is not ready', async () => {
      redisClientMock.status = 'connecting';
      await service.set('key', 'val');
      expect(redisClientMock.set).not.toHaveBeenCalled();
    });

    it('should set value without TTL', async () => {
      await service.set('key', 'val');
      expect(redisClientMock.set).toHaveBeenCalledWith('key', 'val');
    });

    it('should set value with TTL if provided', async () => {
      await service.set('key', 'val', 10);
      expect(redisClientMock.set).toHaveBeenCalledWith('key', 'val', 'EX', 10);
    });

    it('should catch error if redis client set throws', async () => {
      (redisClientMock.set as jest.Mock).mockRejectedValue(
        new Error('Set failed'),
      );
      await expect(service.set('key', 'val')).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should return immediately if redis is not ready', async () => {
      redisClientMock.status = 'connecting';
      await service.del('key');
      expect(redisClientMock.del).not.toHaveBeenCalled();
    });

    it('should delete key', async () => {
      await service.del('key');
      expect(redisClientMock.del).toHaveBeenCalledWith('key');
    });

    it('should catch error if redis client del throws', async () => {
      (redisClientMock.del as jest.Mock).mockRejectedValue(
        new Error('Del failed'),
      );
      await expect(service.del('key')).resolves.not.toThrow();
    });
  });

  describe('delPattern', () => {
    it('should return immediately if redis is not ready', async () => {
      redisClientMock.status = 'connecting';
      await service.delPattern('prefix:*');
      expect(redisClientMock.scan).not.toHaveBeenCalled();
    });

    it('should scan and delete matching keys in batches', async () => {
      (redisClientMock.scan as jest.Mock)
        .mockResolvedValueOnce(['10', ['prefix:1', 'prefix:2']])
        .mockResolvedValueOnce(['0', ['prefix:3']]);

      await service.delPattern('prefix:*');

      expect(redisClientMock.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'prefix:*',
        'COUNT',
        100,
      );
      expect(redisClientMock.scan).toHaveBeenNthCalledWith(
        2,
        '10',
        'MATCH',
        'prefix:*',
        'COUNT',
        100,
      );
      expect(redisClientMock.del).toHaveBeenNthCalledWith(
        1,
        'prefix:1',
        'prefix:2',
      );
      expect(redisClientMock.del).toHaveBeenNthCalledWith(2, 'prefix:3');
    });

    it('should catch error if scan or del throws', async () => {
      (redisClientMock.scan as jest.Mock).mockRejectedValue(
        new Error('Scan failed'),
      );
      await expect(service.delPattern('prefix:*')).resolves.not.toThrow();
    });
  });

  describe('incr', () => {
    it('should return null if redis is not ready', async () => {
      redisClientMock.status = 'connecting';
      const res = await service.incr('key');
      expect(res).toBeNull();
    });

    it('should increment key', async () => {
      (redisClientMock.incr as jest.Mock).mockResolvedValue(5);
      const res = await service.incr('key');
      expect(redisClientMock.incr).toHaveBeenCalledWith('key');
      expect(res).toBe(5);
    });

    it('should catch error and return null if incr throws', async () => {
      (redisClientMock.incr as jest.Mock).mockRejectedValue(
        new Error('Incr failed'),
      );
      const res = await service.incr('key');
      expect(res).toBeNull();
    });
  });

  describe('expire', () => {
    it('should return null if redis is not ready', async () => {
      redisClientMock.status = 'connecting';
      const res = await service.expire('key', 10);
      expect(res).toBeNull();
    });

    it('should set expiration seconds', async () => {
      (redisClientMock.expire as jest.Mock).mockResolvedValue(1);
      const res = await service.expire('key', 10);
      expect(redisClientMock.expire).toHaveBeenCalledWith('key', 10);
      expect(res).toBe(1);
    });

    it('should catch error and return null if expire throws', async () => {
      (redisClientMock.expire as jest.Mock).mockRejectedValue(
        new Error('Expire failed'),
      );
      const res = await service.expire('key', 10);
      expect(res).toBeNull();
    });
  });

  describe('getJson', () => {
    it('should return parsed JSON object if key exists', async () => {
      (redisClientMock.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ name: 'test' }),
      );
      const res = await service.getJson<{ name: string }>('key');
      expect(res).toEqual({ name: 'test' });
    });

    it('should return null if key does not exist', async () => {
      (redisClientMock.get as jest.Mock).mockResolvedValue(null);
      const res = await service.getJson('key');
      expect(res).toBeNull();
    });

    it('should catch parse errors and return null', async () => {
      (redisClientMock.get as jest.Mock).mockResolvedValue('{bad}');
      const res = await service.getJson('key');
      expect(res).toBeNull();
    });
  });

  describe('setJson', () => {
    it('should serialize value and call set', async () => {
      await service.setJson('key', { name: 'test' }, 60);
      expect(redisClientMock.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ name: 'test' }),
        'EX',
        60,
      );
    });

    it('should catch serialization errors without throwing', async () => {
      // Circular reference to trigger serialization failure
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      await expect(service.setJson('key', circular)).resolves.not.toThrow();
    });
  });
});
