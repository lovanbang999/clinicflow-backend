import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getMyNotifications: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('getMyNotifications should delegate to notificationsService.getMyNotifications', async () => {
    const mockReq = { user: { id: 'u-1' } } as unknown as Request;
    serviceMock.getMyNotifications.mockResolvedValue([]);
    const result = await controller.getMyNotifications(mockReq);
    expect(result).toEqual([]);
    expect(serviceMock.getMyNotifications).toHaveBeenCalledWith('u-1');
  });

  it('getMyNotifications should throw UnauthorizedException if req.user is missing', async () => {
    const mockReq = {} as unknown as Request;
    await expect(controller.getMyNotifications(mockReq)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('markAsRead should delegate to notificationsService.markAsRead', async () => {
    const mockReq = { user: { id: 'u-1' } } as unknown as Request;
    serviceMock.markAsRead.mockResolvedValue({ success: true });
    const result = await controller.markAsRead(mockReq, 'notif-1');
    expect(result).toEqual({ success: true });
    expect(serviceMock.markAsRead).toHaveBeenCalledWith('u-1', 'notif-1');
  });

  it('markAsRead should throw UnauthorizedException if req.user is missing', async () => {
    const mockReq = {} as unknown as Request;
    await expect(controller.markAsRead(mockReq, 'notif-1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('markAllAsRead should delegate to notificationsService.markAllAsRead', async () => {
    const mockReq = { user: { id: 'u-1' } } as unknown as Request;
    serviceMock.markAllAsRead.mockResolvedValue({ success: true });
    const result = await controller.markAllAsRead(mockReq);
    expect(result).toEqual({ success: true });
    expect(serviceMock.markAllAsRead).toHaveBeenCalledWith('u-1');
  });

  it('markAllAsRead should throw UnauthorizedException if req.user is missing', async () => {
    const mockReq = {} as unknown as Request;
    await expect(controller.markAllAsRead(mockReq)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should propagate NotFoundException from markAsRead service', async () => {
    const mockReq = { user: { id: 'u-1' } } as unknown as Request;
    serviceMock.markAsRead.mockRejectedValue(
      new NotFoundException('Notification not found'),
    );
    await expect(
      controller.markAsRead(mockReq, 'non-existent'),
    ).rejects.toThrow(NotFoundException);
  });
});
