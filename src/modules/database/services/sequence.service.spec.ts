import { Test, TestingModule } from '@nestjs/testing';
import { SequenceService } from './sequence.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('SequenceService', () => {
  let service: SequenceService;
  let prismaMock: {
    sequenceCounter: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      sequenceCounter: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SequenceService>(SequenceService);
  });

  it('should generate next sequence successfully', async () => {
    prismaMock.sequenceCounter.upsert.mockResolvedValue({
      key: 'test-key',
      value: 5,
    });

    const result = await service.generateNextSequence('test-key');

    expect(prismaMock.sequenceCounter.upsert).toHaveBeenCalledWith({
      where: { key: 'test-key' },
      create: { key: 'test-key', value: 1 },
      update: { value: { increment: 1 } },
    });
    expect(result).toBe(5);
  });

  it('should fall back to update if upsert fails due to race condition (P2002)', async () => {
    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'x.y.z',
      },
    );

    prismaMock.sequenceCounter.upsert.mockRejectedValue(p2002Error);
    prismaMock.sequenceCounter.update.mockResolvedValue({
      key: 'test-key',
      value: 2,
    });

    const result = await service.generateNextSequence('test-key');

    expect(prismaMock.sequenceCounter.upsert).toHaveBeenCalled();
    expect(prismaMock.sequenceCounter.update).toHaveBeenCalledWith({
      where: { key: 'test-key' },
      data: { value: { increment: 1 } },
    });
    expect(result).toBe(2);
  });

  it('should throw error if upsert fails with other non-race condition error', async () => {
    const error = new Error('Database connection failed');
    prismaMock.sequenceCounter.upsert.mockRejectedValue(error);

    await expect(service.generateNextSequence('test-key')).rejects.toThrow(
      'Database connection failed',
    );
    expect(prismaMock.sequenceCounter.update).not.toHaveBeenCalled();
  });
});
