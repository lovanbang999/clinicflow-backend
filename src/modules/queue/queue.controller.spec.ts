import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PromoteQueueDto } from './dto/promote-queue.dto';
import { QueueFilterDto } from './dto/queue-filter.dto';

describe('QueueController', () => {
  let controller: QueueController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn(),
      getStatistics: jest.fn(),
      findByBookingId: jest.fn(),
      promoteManually: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<QueueController>(QueueController);
  });

  it('findAll should delegate to queueService.findAll', async () => {
    const filterDto: QueueFilterDto = { page: 1, limit: 10 };
    serviceMock.findAll.mockResolvedValue([]);
    const result = await controller.findAll(filterDto);
    expect(result).toEqual([]);
    expect(serviceMock.findAll).toHaveBeenCalledWith(filterDto);
  });

  it('getStatistics should delegate to queueService.getStatistics', async () => {
    serviceMock.getStatistics.mockResolvedValue({ totalQueued: 5 });
    const result = await controller.getStatistics('doc-1', '2028-12-01');
    expect(result).toEqual({ totalQueued: 5 });
    expect(serviceMock.getStatistics).toHaveBeenCalledWith(
      'doc-1',
      '2028-12-01',
    );
  });

  it('findByBookingId should delegate to queueService.findByBookingId', async () => {
    serviceMock.findByBookingId.mockResolvedValue({ id: 'qr-1' });
    const result = await controller.findByBookingId('b-1');
    expect(result).toEqual({ id: 'qr-1' });
    expect(serviceMock.findByBookingId).toHaveBeenCalledWith('b-1');
  });

  it('promoteManually should delegate to queueService.promoteManually', async () => {
    const dto: PromoteQueueDto = { bookingId: 'b-1', reason: 'urgent' };
    serviceMock.promoteManually.mockResolvedValue({ success: true });
    const result = await controller.promoteManually(dto, 'u-1');
    expect(result).toEqual({ success: true });
    expect(serviceMock.promoteManually).toHaveBeenCalledWith(dto, 'u-1');
  });

  it('should propagate NotFoundException from findByBookingId service', async () => {
    serviceMock.findByBookingId.mockRejectedValue(
      new NotFoundException('Queue record not found'),
    );
    await expect(controller.findByBookingId('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should propagate BadRequestException from promoteManually service', async () => {
    const dto: PromoteQueueDto = { bookingId: 'b-1' };
    serviceMock.promoteManually.mockRejectedValue(
      new BadRequestException('Cannot promote'),
    );
    await expect(controller.promoteManually(dto, 'u-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
