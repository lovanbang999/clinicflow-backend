import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  NotificationType,
  ServiceOrderStatus,
  VisitServiceOrder,
  Prisma,
} from '@prisma/client';
import {
  VisitServiceOrderDetail,
  VisitServiceOrderWorklistItem,
} from '../database/types/prisma-payload.types';

import { CompleteServiceOrderDto } from './dto/complete-service-order.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VisitServiceOrdersService {
  private readonly logger = new Logger(VisitServiceOrdersService.name);

  constructor(
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  // KTV Worklist — list service orders assigned to perform
  async getWorklist(
    technicianId: string,
    status?: ServiceOrderStatus,
  ): Promise<VisitServiceOrderWorklistItem[]> {
    const orders =
      await this.clinicalRepository.findVisitServiceOrdersWorklist(status);
    return orders;
  }

  // KTV starts a service order
  async startOrder(
    orderId: string,
    technicianId: string,
  ): Promise<VisitServiceOrder> {
    const order =
      await this.clinicalRepository.findVisitServiceOrderById(orderId);
    if (!order) throw new NotFoundException('Service order not found');
    if (order.status !== ServiceOrderStatus.PENDING)
      throw new ConflictException(`Order is already ${order.status}`);

    const updated = await this.clinicalRepository.startVisitServiceOrder(
      orderId,
      technicianId,
    );

    this.logger.log(
      `Technician ${technicianId} started service order ${orderId} successfully`,
    );

    return updated;
  }

  // KTV completes a service order + auto-advance MedicalRecord step
  async completeOrder(
    orderId: string,
    dto: CompleteServiceOrderDto,
    technicianId: string,
  ): Promise<VisitServiceOrder> {
    const order =
      await this.clinicalRepository.findVisitServiceOrderById(orderId);
    if (!order) throw new NotFoundException('Service order not found');
    if (order.status === ServiceOrderStatus.COMPLETED)
      throw new ConflictException('Order already completed');
    if (order.status === ServiceOrderStatus.CANCELLED)
      throw new BadRequestException('Cannot complete a cancelled order');

    const result =
      await this.clinicalRepository.completeVisitServiceOrderTransaction(
        orderId,
        technicianId,
        {
          ...dto,
          findings: dto.findings as Prisma.InputJsonValue,
        },
      );

    this.logger.log(
      `Technician ${technicianId} completed service order ${orderId} successfully`,
    );

    if (result.advanced && result.record?.booking?.doctorId) {
      // Do not await, fire and forget to not block transaction
      this.notificationsService
        .createInAppNotification({
          userId: result.record.booking.doctorId,
          title: 'Kết quả CLS đã có',
          content: `Bệnh nhân ${result.record.booking.patientProfile?.fullName ?? '...'} đã hoàn tất các chỉ định cận lâm sàng. Bạn có thể chẩn đoán ngay.`,
          type: NotificationType.LAB_RESULT_READY,
          metadata: {
            bookingId: result.record.bookingId,
            recordId: result.record.id,
          },
        })
        .catch((err) =>
          this.logger.error(
            'Failed to send notification for RESULTS_READY:',
            err instanceof Error ? err.stack : String(err),
          ),
        );
    }

    return result.completedOrder;
  }

  // Get detail of a single service order
  async getOrderDetail(orderId: string): Promise<VisitServiceOrderDetail> {
    const order =
      await this.clinicalRepository.findVisitServiceOrderDetailById(orderId);
    if (!order) throw new NotFoundException('Service order not found');
    return order;
  }
}
