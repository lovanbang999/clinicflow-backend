import { Test, TestingModule } from '@nestjs/testing';
import { VisitServiceOrdersService } from './visit-service-orders.service';
import {
  I_CLINICAL_REPOSITORY,
  IClinicalRepository,
} from '../database/interfaces/clinical.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, ServiceOrderStatus, VisitServiceOrder } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

type MockClinicalRepo = Partial<Record<keyof IClinicalRepository, jest.Mock>>;

const buildOrder = (overrides: Partial<VisitServiceOrder> = {}): VisitServiceOrder =>
  ({
    id: 'order-1',
    bookingId: 'booking-1',
    medicalRecordId: 'record-1',
    serviceId: 'service-1',
    status: ServiceOrderStatus.PENDING,
    performedBy: 'tech-1',
    performerType: 'TECHNICIAN',
    queueNumber: 1,
    resultText: null,
    resultFileUrl: null,
    isAbnormal: false,
    abnormalNote: null,
    findings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    notes: null,
    ...overrides,
  } as VisitServiceOrder);

describe('VisitServiceOrdersService', () => {
  let service: VisitServiceOrdersService;
  let clinicalRepository: MockClinicalRepo;
  let notificationsService: { createInAppNotification: jest.Mock };

  beforeEach(async () => {
    clinicalRepository = {
      findVisitServiceOrdersWorklist: jest.fn(),
      findVisitServiceOrderById: jest.fn(),
      startVisitServiceOrder: jest.fn(),
      completeVisitServiceOrderTransaction: jest.fn(),
      findVisitServiceOrderDetailById: jest.fn(),
    };

    notificationsService = {
      createInAppNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitServiceOrdersService,
        { provide: I_CLINICAL_REPOSITORY, useValue: clinicalRepository },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<VisitServiceOrdersService>(VisitServiceOrdersService);
  });

  describe('getWorklist', () => {
    it('should return the worklist from clinical repository', async () => {
      // Arrange
      const mockWorklist = [
        { id: 'order-1', status: ServiceOrderStatus.PENDING },
        { id: 'order-2', status: ServiceOrderStatus.IN_PROGRESS },
      ];
      (clinicalRepository.findVisitServiceOrdersWorklist as jest.Mock).mockResolvedValue(mockWorklist);

      // Act
      const result = await service.getWorklist('tech-1');

      // Assert
      expect(result).toEqual(mockWorklist);
      expect(clinicalRepository.findVisitServiceOrdersWorklist).toHaveBeenCalledWith(undefined);
    });

    it('should pass status filter to clinical repository', async () => {
      // Arrange
      (clinicalRepository.findVisitServiceOrdersWorklist as jest.Mock).mockResolvedValue([]);

      // Act
      await service.getWorklist('tech-1', ServiceOrderStatus.PAID);

      // Assert
      expect(clinicalRepository.findVisitServiceOrdersWorklist).toHaveBeenCalledWith(
        ServiceOrderStatus.PAID,
      );
    });
  });

  describe('startOrder', () => {
    it('should start a PENDING order successfully', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.PENDING });
      const updatedOrder = buildOrder({ status: ServiceOrderStatus.IN_PROGRESS });

      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);
      (clinicalRepository.startVisitServiceOrder as jest.Mock).mockResolvedValue(updatedOrder);

      // Act
      const result = await service.startOrder('order-1', 'tech-1');

      // Assert
      expect(result.status).toBe(ServiceOrderStatus.IN_PROGRESS);
      expect(clinicalRepository.startVisitServiceOrder).toHaveBeenCalledWith('order-1', 'tech-1');
    });

    it('should throw NotFoundException when order does not exist', async () => {
      // Arrange
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.startOrder('missing-order', 'tech-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when order is not in PENDING status', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.IN_PROGRESS });
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);

      // Act & Assert
      await expect(service.startOrder('order-1', 'tech-1')).rejects.toThrow(ConflictException);
    });

    it('should call clinical repository with domain-level parameters (no Prisma objects)', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.PENDING });
      const updatedOrder = buildOrder({ status: ServiceOrderStatus.IN_PROGRESS });
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);
      (clinicalRepository.startVisitServiceOrder as jest.Mock).mockResolvedValue(updatedOrder);

      // Act
      await service.startOrder('order-1', 'tech-42');

      // Assert — the call must use plain string IDs, not Prisma-shaped objects
      expect(clinicalRepository.startVisitServiceOrder).toHaveBeenCalledWith('order-1', 'tech-42');
      const [arg0, arg1] = (clinicalRepository.startVisitServiceOrder as jest.Mock).mock.calls[0];
      expect(typeof arg0).toBe('string');
      expect(typeof arg1).toBe('string');
    });
  });

  describe('completeOrder', () => {
    it('should complete an IN_PROGRESS order and notify doctor when advanced', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.IN_PROGRESS });
      const completedOrder = buildOrder({ status: ServiceOrderStatus.COMPLETED });
      const dto = { resultText: 'All normal', isAbnormal: false };

      const result = {
        completedOrder,
        advanced: true,
        record: {
          id: 'record-1',
          bookingId: 'booking-1',
          booking: {
            doctorId: 'doctor-1',
            patientProfile: { fullName: 'Patient A' },
          },
        },
      };

      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);
      (clinicalRepository.completeVisitServiceOrderTransaction as jest.Mock).mockResolvedValue(result);

      // Act
      const response = await service.completeOrder('order-1', dto, 'tech-1');

      // Assert
      expect(response.status).toBe(ServiceOrderStatus.COMPLETED);
      // Give micro-task queue a tick so the fire-and-forget notification resolves
      await new Promise((r) => setTimeout(r, 0));
      expect(notificationsService.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'doctor-1',
          type: NotificationType.LAB_RESULT_READY,
        }),
      );
    });

    it('should complete an order without sending notification when not advanced', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.IN_PROGRESS });
      const completedOrder = buildOrder({ status: ServiceOrderStatus.COMPLETED });
      const dto = { resultText: 'Pending review' };

      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);
      (clinicalRepository.completeVisitServiceOrderTransaction as jest.Mock).mockResolvedValue({
        completedOrder,
        advanced: false,
        record: null,
      });

      // Act
      await service.completeOrder('order-1', dto, 'tech-1');

      // Assert
      await new Promise((r) => setTimeout(r, 0));
      expect(notificationsService.createInAppNotification).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      // Arrange
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.completeOrder('missing', {}, 'tech-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when order is already COMPLETED', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.COMPLETED });
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);

      // Act & Assert
      await expect(service.completeOrder('order-1', {}, 'tech-1')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when order is CANCELLED', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.CANCELLED });
      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);

      // Act & Assert
      await expect(service.completeOrder('order-1', {}, 'tech-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass findings as Prisma.InputJsonValue to the transaction', async () => {
      // Arrange
      const order = buildOrder({ status: ServiceOrderStatus.IN_PROGRESS });
      const completedOrder = buildOrder({ status: ServiceOrderStatus.COMPLETED });
      const dto = { findings: { status: 'normal', conclusion: 'All clear' } as { status: string; conclusion: string }, isAbnormal: true };

      (clinicalRepository.findVisitServiceOrderById as jest.Mock).mockResolvedValue(order);
      (clinicalRepository.completeVisitServiceOrderTransaction as jest.Mock).mockResolvedValue({
        completedOrder,
        advanced: false,
        record: null,
      });

      // Act
      await service.completeOrder('order-1', dto, 'tech-1');

      // Assert — verify the findings object was passed through
      expect(clinicalRepository.completeVisitServiceOrderTransaction).toHaveBeenCalledWith(
        'order-1',
        'tech-1',
        expect.objectContaining({
          findings: dto.findings,
          isAbnormal: true,
        }),
      );
    });
  });

  describe('getOrderDetail', () => {
    it('should return order detail when found', async () => {
      // Arrange
      const detail = { id: 'order-1', status: ServiceOrderStatus.COMPLETED, service: { name: 'X-Ray' } };
      (clinicalRepository.findVisitServiceOrderDetailById as jest.Mock).mockResolvedValue(detail);

      // Act
      const result = await service.getOrderDetail('order-1');

      // Assert
      expect(result).toEqual(detail);
      expect(clinicalRepository.findVisitServiceOrderDetailById).toHaveBeenCalledWith('order-1');
    });

    it('should throw NotFoundException when order detail is not found', async () => {
      // Arrange
      (clinicalRepository.findVisitServiceOrderDetailById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrderDetail('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
