import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LabOrderStatus, Prisma, VisitStep } from '@prisma/client';

import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteServiceOrderDto } from './dto/complete-service-order.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class VisitServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // KTV Worklist — list service orders assigned to perform
  async getWorklist(technicianId: string, status?: LabOrderStatus) {
    const where: Prisma.VisitServiceOrderWhereInput = {
      status: status ?? {
        in: [LabOrderStatus.PENDING, LabOrderStatus.IN_PROGRESS],
      },
    };

    const orders = await this.prisma.visitServiceOrder.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: {
        service: {
          select: { id: true, name: true, category: true, serviceCode: true },
        },
        medicalRecord: {
          include: {
            booking: {
              include: {
                patientProfile: {
                  select: {
                    id: true,
                    patientCode: true,
                    fullName: true,
                    phone: true,
                    gender: true,
                    dateOfBirth: true,
                  },
                },
                doctor: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    });

    return ResponseHelper.success(
      orders,
      'VSO.WORKLIST_FETCHED',
      'Worklist fetched',
      200,
    );
  }

  // KTV starts a service order
  async startOrder(orderId: string, technicianId: string) {
    const order = await this.prisma.visitServiceOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Service order not found');
    if (order.status !== LabOrderStatus.PENDING)
      throw new ConflictException(`Order is already ${order.status}`);

    const updated = await this.prisma.visitServiceOrder.update({
      where: { id: orderId },
      data: {
        status: LabOrderStatus.IN_PROGRESS,
        performedBy: technicianId,
        startedAt: new Date(),
      },
    });

    return ResponseHelper.success(
      updated,
      'VSO.STARTED',
      'Service order started',
      200,
    );
  }

  // KTV completes a service order + auto-advance MedicalRecord step
  async completeOrder(
    orderId: string,
    dto: CompleteServiceOrderDto,
    technicianId: string,
  ) {
    const order = await this.prisma.visitServiceOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Service order not found');
    if (order.status === LabOrderStatus.COMPLETED)
      throw new ConflictException('Order already completed');
    if (order.status === LabOrderStatus.CANCELLED)
      throw new BadRequestException('Cannot complete a cancelled order');

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Mark order as COMPLETED
      const completed = await tx.visitServiceOrder.update({
        where: { id: orderId },
        data: {
          status: LabOrderStatus.COMPLETED,
          performedBy: technicianId,
          resultText: dto.resultText,
          resultFileUrl: dto.resultFileUrl,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          completedAt: new Date(),
        },
      });

      // Auto-advance MedicalRecord to RESULTS_READY if all sibling orders are done
      const allSiblings = await tx.visitServiceOrder.findMany({
        where: { medicalRecordId: order.medicalRecordId },
        select: { id: true, status: true },
      });

      const allDone = allSiblings.every(
        (o) => o.id === orderId || o.status === LabOrderStatus.COMPLETED,
      );

      if (allDone) {
        const record = await tx.medicalRecord.findUnique({
          where: { id: order.medicalRecordId },
          include: {
            booking: {
              include: { patientProfile: true },
            },
          },
        });

        // Only advance if currently AWAITING_RESULTS; never step backward
        if (record && record.visitStep === VisitStep.AWAITING_RESULTS) {
          await tx.medicalRecord.update({
            where: { id: order.medicalRecordId },
            data: {
              visitStep: VisitStep.RESULTS_READY,
              version: { increment: 1 },
            },
          });

          // Notify doctor
          if (record.booking?.doctorId) {
            // Do not await, fire and forget to not block transaction
            this.notificationsService
              .createInAppNotification({
                userId: record.booking.doctorId,
                title: 'Kết quả CLS đã có',
                content: `Bệnh nhân ${record.booking.patientProfile?.fullName ?? '...'} đã hoàn tất các chỉ định cận lâm sàng. Bạn có thể chẩn đoán ngay.`,
                type: NotificationType.LAB_RESULT_READY,
                metadata: { bookingId: record.bookingId, recordId: record.id },
              })
              .catch((err) =>
                console.error(
                  'Failed to send notification for RESULTS_READY',
                  err,
                ),
              );
          }
        }
      }

      return completed;
    });

    return ResponseHelper.success(
      updatedOrder,
      'VSO.COMPLETED',
      'Service order completed',
      200,
    );
  }

  // Get detail of a single service order
  async getOrderDetail(orderId: string) {
    const order = await this.prisma.visitServiceOrder.findUnique({
      where: { id: orderId },
      include: {
        service: true,
        medicalRecord: {
          include: {
            booking: {
              include: {
                patientProfile: true,
                doctor: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Service order not found');
    return ResponseHelper.success(order, 'VSO.DETAIL_FETCHED', '', 200);
  }
}
