import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = mockConnect;
    $disconnect = mockDisconnect;
  }
  return {
    PrismaClient: MockPrismaClient,
  };
});

jest.mock('@prisma/adapter-mariadb', () => {
  return {
    PrismaMariaDb: jest.fn().mockImplementation(() => {
      return {};
    }),
  };
});

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(() => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
  });

  beforeEach(async () => {
    mockConnect.mockClear();
    mockDisconnect.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  describe('lifecycle', () => {
    it('should connect on module init', async () => {
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should disconnect on module destroy', async () => {
      await service.onModuleDestroy();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('cleanDatabase', () => {
    it('should throw error in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(service.cleanDatabase()).rejects.toThrow(
        'Cannot clean database in production!',
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should clean all models with deleteMany in non-production environments', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });

      // Add a dummy model to test target deletion mapping
      Object.defineProperty(service, 'dummyModel', {
        value: { deleteMany: mockDeleteMany },
        writable: true,
        enumerable: true,
        configurable: true,
      });

      await service.cleanDatabase();

      expect(mockDeleteMany).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
