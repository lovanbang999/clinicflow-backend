import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UploadLabResultDto } from './dto/upload-lab-result.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { LabOrderStatus, InvoiceStatus } from '@prisma/client';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class LabOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async createOrder(doctorId: string, dto: CreateLabOrderDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.doctorId !== doctorId) {
      throw new ForbiddenException('Not authorized to access this booking');
    }

    // Ensure medical record exists
    let medicalRecord = await this.prisma.medicalRecord.findUnique({
      where: { bookingId: dto.bookingId },
    });

    if (!medicalRecord) {
      medicalRecord = await this.prisma.medicalRecord.create({
        data: {
          bookingId: dto.bookingId,
          patientProfileId: booking.patientProfileId,
          doctorId: booking.doctorId,
          isFinalized: false,
        },
      });
    }

    const labOrder = await this.prisma.labOrder.create({
      data: {
        bookingId: dto.bookingId,
        medicalRecordId: medicalRecord.id,
        patientProfileId: booking.patientProfileId,
        doctorId: booking.doctorId,
        testName: dto.testName,
        testDescription: dto.testDescription,
        status: LabOrderStatus.PENDING,
      },
    });

    // Auto-add this lab order to the patient's master invoice
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { bookingId: dto.bookingId },
      });

      if (
        invoice &&
        (invoice.status === InvoiceStatus.DRAFT ||
          invoice.status === InvoiceStatus.OPEN)
      ) {
        let price = 0;
        let itemName = dto.testName;

        if (dto.serviceId) {
          const svc = await this.prisma.service.findUnique({
            where: { id: dto.serviceId },
          });
          if (svc) {
            price = Number(svc.price);
            itemName = svc.name;
          }
        }

        await this.billingService.addInvoiceItem(invoice.id, {
          serviceId: dto.serviceId,
          labOrderId: labOrder.id,
          itemName: itemName,
          unitPrice: price,
          quantity: 1,
        });
      }
    } catch (error) {
      console.error('Failed to auto-add lab order to invoice', error);
      // We don't fail the lab order creation if billing fails, though ideally they are atomic.
    }

    return ResponseHelper.success(
      labOrder,
      'LAB.ORDER_CREATED',
      'Lab order created successfully',
      201,
    );
  }

  async getOrdersByBooking(bookingId: string) {
    const orders = await this.prisma.labOrder.findMany({
      where: { bookingId },
      include: {
        result: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ResponseHelper.success(orders, 'LAB.FETCHED', '', 200);
  }

  async getPendingOrders() {
    const rawOrders = await this.prisma.labOrder.findMany({
      where: {
        status: {
          in: [LabOrderStatus.PENDING, LabOrderStatus.IN_PROGRESS],
        },
      },
      include: {
        booking: {
          select: {
            bookingCode: true,
            doctor: {
              select: { fullName: true },
            },
            patientProfile: {
              select: {
                fullName: true,
                patientCode: true,
                gender: true,
                dateOfBirth: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const orders = rawOrders.map((order) => {
      const { booking, ...rest } = order;
      if (!booking) return rest;
      return {
        ...rest,
        booking: {
          bookingCode: booking.bookingCode,
          doctor: booking.doctor,
        },
        patientProfile: booking.patientProfile,
      };
    });

    return ResponseHelper.success(orders, 'LAB.FETCHED_PENDING', '', 200);
  }

  async addResult(
    resultAuthorId: string,
    labOrderId: string,
    dto: UploadLabResultDto,
  ) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: labOrderId },
    });

    if (!order) {
      throw new NotFoundException('Lab order not found');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Upsert lab result
      await tx.labResult.upsert({
        where: { labOrderId },
        create: {
          labOrderId,
          resultText: dto.resultText,
          resultFileUrl: dto.resultFileUrl,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          recordedBy: resultAuthorId,
          resultDate: new Date(),
        },
        update: {
          resultText: dto.resultText,
          resultFileUrl: dto.resultFileUrl,
          isAbnormal: dto.isAbnormal,
          abnormalNote: dto.abnormalNote,
          recordedBy: resultAuthorId,
          resultDate: new Date(),
        },
      });

      // Update order status
      return tx.labOrder.update({
        where: { id: labOrderId },
        data: { status: LabOrderStatus.COMPLETED },
        include: { result: true },
      });
    });

    return ResponseHelper.success(
      updatedOrder,
      'LAB.RESULT_ADDED',
      'Lab result saved',
      200,
    );
  }

  async deleteOrder(doctorId: string, labOrderId: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: labOrderId },
    });

    if (!order) {
      throw new NotFoundException('Lab order not found');
    }

    if (order.doctorId !== doctorId) {
      throw new ForbiddenException(
        'Only the assigned doctor can delete this order',
      );
    }

    if (order.status === LabOrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete a completed lab order');
    }

    await this.prisma.labOrder.delete({
      where: { id: labOrderId },
    });

    return ResponseHelper.success(
      null,
      'LAB.ORDER_DELETED',
      'Lab order deleted',
      200,
    );
  }
}
