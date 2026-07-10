import { Test, TestingModule } from '@nestjs/testing';
import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersService } from './lab-orders.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UploadLabResultDto } from './dto/upload-lab-result.dto';
import { User, UserRole, LabOrderStatus } from '@prisma/client';

describe('LabOrdersController', () => {
  let controller: LabOrdersController;
  let serviceMock: Record<string, jest.Mock>;

  const mockUser = {
    id: 'u-1',
    email: 'test@example.com',
    role: UserRole.DOCTOR,
  } as unknown as User;

  beforeEach(async () => {
    serviceMock = {
      createOrder: jest.fn(),
      getOrdersByBooking: jest.fn(),
      getPendingOrders: jest.fn(),
      getReadyToPerformOrders: jest.fn(),
      getTechnicianStats: jest.fn(),
      getTechnicianHistory: jest.fn(),
      getOrderById: jest.fn(),
      getPendingUnbilledOrders: jest.fn(),
      addResult: jest.fn(),
      deleteOrder: jest.fn(),
      updateStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabOrdersController],
      providers: [
        {
          provide: LabOrdersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<LabOrdersController>(LabOrdersController);
  });

  it('createLabOrder should delegate to labOrdersService.createOrder', async () => {
    const dto: CreateLabOrderDto = { bookingId: 'b-1', testName: 'Blood Test' };
    serviceMock.createOrder.mockResolvedValue({ id: 'lo-1' });
    const result = await controller.createLabOrder(mockUser, dto);
    expect(result).toEqual({ id: 'lo-1' });
    expect(serviceMock.createOrder).toHaveBeenCalledWith('u-1', dto, mockUser);
  });

  it('getLabOrdersByBooking should delegate to labOrdersService.getOrdersByBooking', async () => {
    serviceMock.getOrdersByBooking.mockResolvedValue([]);
    const result = await controller.getLabOrdersByBooking('b-1', mockUser);
    expect(result).toEqual([]);
    expect(serviceMock.getOrdersByBooking).toHaveBeenCalledWith(
      'b-1',
      mockUser,
    );
  });

  it('getPendingOrders should delegate to labOrdersService.getPendingOrders', async () => {
    serviceMock.getPendingOrders.mockResolvedValue([]);
    const result = await controller.getPendingOrders();
    expect(result).toEqual([]);
    expect(serviceMock.getPendingOrders).toHaveBeenCalled();
  });

  it('getReadyToPerformOrders should delegate to labOrdersService.getReadyToPerformOrders', async () => {
    serviceMock.getReadyToPerformOrders.mockResolvedValue([]);
    const result = await controller.getReadyToPerformOrders(mockUser);
    expect(result).toEqual([]);
    expect(serviceMock.getReadyToPerformOrders).toHaveBeenCalledWith(mockUser);
  });

  it('getTechnicianStats should delegate to labOrdersService.getTechnicianStats', async () => {
    serviceMock.getTechnicianStats.mockResolvedValue({ completed: 5 });
    const result = await controller.getTechnicianStats();
    expect(result).toEqual({ completed: 5 });
    expect(serviceMock.getTechnicianStats).toHaveBeenCalled();
  });

  it('getTechnicianHistory should delegate to labOrdersService.getTechnicianHistory', async () => {
    serviceMock.getTechnicianHistory.mockResolvedValue([]);
    const result = await controller.getTechnicianHistory(
      mockUser,
      '2028-12-01',
      '2028-12-05',
      'cat-1',
      'FORM',
      'search',
      '2',
      '10',
    );
    expect(result).toEqual([]);
    expect(serviceMock.getTechnicianHistory).toHaveBeenCalledWith(mockUser, {
      startDate: '2028-12-01',
      endDate: '2028-12-05',
      categoryId: 'cat-1',
      labFormType: 'FORM',
      search: 'search',
      page: 2,
      limit: 10,
    });
  });

  it('getLabOrderById should delegate to labOrdersService.getOrderById', async () => {
    serviceMock.getOrderById.mockResolvedValue({ id: 'lo-1' });
    const result = await controller.getLabOrderById(mockUser, 'lo-1');
    expect(result).toEqual({ id: 'lo-1' });
    expect(serviceMock.getOrderById).toHaveBeenCalledWith('lo-1', mockUser);
  });

  it('getPendingUnbilledOrders should delegate to labOrdersService.getPendingUnbilledOrders', async () => {
    serviceMock.getPendingUnbilledOrders.mockResolvedValue([]);
    const result = await controller.getPendingUnbilledOrders('b-1', mockUser);
    expect(result).toEqual([]);
    expect(serviceMock.getPendingUnbilledOrders).toHaveBeenCalledWith(
      'b-1',
      mockUser,
    );
  });

  it('addResult should delegate to labOrdersService.addResult', async () => {
    const dto: UploadLabResultDto = { resultText: 'normal' };
    serviceMock.addResult.mockResolvedValue({ success: true });
    const result = await controller.addResult(mockUser, 'lo-1', dto);
    expect(result).toEqual({ success: true });
    expect(serviceMock.addResult).toHaveBeenCalledWith(
      'u-1',
      'lo-1',
      dto,
      mockUser,
    );
  });

  it('deleteOrder should delegate to labOrdersService.deleteOrder', async () => {
    serviceMock.deleteOrder.mockResolvedValue({ success: true });
    const result = await controller.deleteOrder(mockUser, 'lo-1');
    expect(result).toEqual({ success: true });
    expect(serviceMock.deleteOrder).toHaveBeenCalledWith(
      'u-1',
      'lo-1',
      mockUser,
    );
  });

  it('updateStatus should delegate to labOrdersService.updateStatus', async () => {
    serviceMock.updateStatus.mockResolvedValue({ success: true });
    const result: unknown = await controller.updateStatus(
      'lo-1',
      LabOrderStatus.IN_PROGRESS,
      mockUser,
    );
    expect(result).toEqual({ success: true });
    expect(serviceMock.updateStatus).toHaveBeenCalledWith(
      'lo-1',
      LabOrderStatus.IN_PROGRESS,
      mockUser,
    );
  });

  it('should propagate NotFoundException from getOrderById service', async () => {
    serviceMock.getOrderById.mockRejectedValue(
      new NotFoundException('Order not found'),
    );
    await expect(
      controller.getLabOrderById(mockUser, 'non-existent'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should propagate BadRequestException from addResult service', async () => {
    const dto: UploadLabResultDto = {};
    serviceMock.addResult.mockRejectedValue(
      new BadRequestException('Invalid data'),
    );
    await expect(controller.addResult(mockUser, 'lo-1', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should propagate ConflictException from deleteOrder service', async () => {
    serviceMock.deleteOrder.mockRejectedValue(
      new ConflictException('Cannot delete'),
    );
    await expect(controller.deleteOrder(mockUser, 'lo-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
