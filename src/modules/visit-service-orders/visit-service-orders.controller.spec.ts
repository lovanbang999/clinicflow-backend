import { Test, TestingModule } from '@nestjs/testing';
import { VisitServiceOrdersController } from './visit-service-orders.controller';
import { VisitServiceOrdersService } from './visit-service-orders.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CompleteServiceOrderDto } from './dto/complete-service-order.dto';
import { ServiceOrderStatus } from '@prisma/client';

describe('VisitServiceOrdersController', () => {
  let controller: VisitServiceOrdersController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getWorklist: jest.fn(),
      getOrderDetail: jest.fn(),
      startOrder: jest.fn(),
      completeOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitServiceOrdersController],
      providers: [
        {
          provide: VisitServiceOrdersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<VisitServiceOrdersController>(
      VisitServiceOrdersController,
    );
  });

  it('getWorklist should delegate to service.getWorklist', async () => {
    const mockReq = { user: { id: 'u-1' } };
    serviceMock.getWorklist.mockResolvedValue([]);
    const result = await controller.getWorklist(
      mockReq,
      ServiceOrderStatus.PENDING,
    );
    expect(result).toEqual([]);
    expect(serviceMock.getWorklist).toHaveBeenCalledWith(
      'u-1',
      ServiceOrderStatus.PENDING,
    );
  });

  it('getDetail should delegate to service.getOrderDetail', async () => {
    serviceMock.getOrderDetail.mockResolvedValue({ id: 'vso-1' });
    const result = await controller.getDetail('vso-1');
    expect(result).toEqual({ id: 'vso-1' });
    expect(serviceMock.getOrderDetail).toHaveBeenCalledWith('vso-1');
  });

  it('startOrder should delegate to service.startOrder', async () => {
    const mockReq = { user: { id: 'u-1' } };
    serviceMock.startOrder.mockResolvedValue({ success: true });
    const result = await controller.startOrder('vso-1', mockReq);
    expect(result).toEqual({ success: true });
    expect(serviceMock.startOrder).toHaveBeenCalledWith('vso-1', 'u-1');
  });

  it('completeOrder should delegate to service.completeOrder', async () => {
    const mockReq = { user: { id: 'u-1' } };
    const dto: CompleteServiceOrderDto = { resultText: 'completed findings' };
    serviceMock.completeOrder.mockResolvedValue({ success: true });
    const result = await controller.completeOrder('vso-1', dto, mockReq);
    expect(result).toEqual({ success: true });
    expect(serviceMock.completeOrder).toHaveBeenCalledWith('vso-1', dto, 'u-1');
  });

  it('should propagate NotFoundException from getDetail service', async () => {
    serviceMock.getOrderDetail.mockRejectedValue(
      new NotFoundException('Order not found'),
    );
    await expect(controller.getDetail('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should propagate BadRequestException from completeOrder service', async () => {
    const mockReq = { user: { id: 'u-1' } };
    const dto: CompleteServiceOrderDto = {};
    serviceMock.completeOrder.mockRejectedValue(
      new BadRequestException('Invalid data'),
    );
    await expect(
      controller.completeOrder('vso-1', dto, mockReq),
    ).rejects.toThrow(BadRequestException);
  });
});
