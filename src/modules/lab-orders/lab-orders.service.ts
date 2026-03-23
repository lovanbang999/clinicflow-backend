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
import { LabOrderStatus } from '@prisma/client';

@Injectable()
export class LabOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Doctor create lab order
   * Lab order is created with status PENDING (isPaid = false).
   * Receptionist will create a LAB invoice to collect payment, backend automatically seeds items from PENDING orders.
   */
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
        status: LabOrderStatus.PENDING, // isPaid = false — receptionist will create a LAB invoice to collect payment
      },
    });

    return ResponseHelper.success(
      labOrder,
      'LAB.ORDER_CREATED',
      'Lab order created. Receptionist must create a LAB invoice to collect payment.',
      201,
    );
  }

  async getOrdersByBooking(bookingId: string) {
    const orders = await this.prisma.labOrder.findMany({
      where: { bookingId },
      include: {
        result: true,
        invoiceItem: {
          include: {
            invoice: {
              select: { id: true, invoiceNumber: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ResponseHelper.success(orders, 'LAB.FETCHED', '', 200);
  }

  /**
   * Get PENDING lab orders for a booking not yet added to any invoice.
   * Used for receptionist to know when to create a LAB invoice.
   */
  async getPendingUnbilledOrders(bookingId: string) {
    const orders = await this.prisma.labOrder.findMany({
      where: {
        bookingId,
        status: LabOrderStatus.PENDING,
        invoiceItem: null, // not yet added to any invoice
      },
      orderBy: { createdAt: 'asc' },
    });
    return ResponseHelper.success(
      orders,
      'LAB.PENDING_UNBILLED_FETCHED',
      '',
      200,
    );
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

  /**
   * Technician view list of lab orders that have been paid (PAID) and are ready to perform.
   */
  async getReadyToPerformOrders() {
    const rawOrders = await this.prisma.labOrder.findMany({
      where: { status: LabOrderStatus.PAID },
      include: {
        booking: {
          select: {
            bookingCode: true,
            doctor: { select: { fullName: true } },
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
        booking: { bookingCode: booking.bookingCode, doctor: booking.doctor },
        patientProfile: booking.patientProfile,
      };
    });

    return ResponseHelper.success(
      orders,
      'LAB.FETCHED_READY',
      'Ready to perform orders',
      200,
    );
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

      // Update order status → COMPLETED
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
