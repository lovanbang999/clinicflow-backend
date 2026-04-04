import { Injectable, HttpStatus } from '@nestjs/common';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UploadLabResultDto } from './dto/upload-lab-result.dto';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { LabOrderStatus } from '@prisma/client';
import { LabOrdersGateway } from './lab-orders.gateway';

@Injectable()
export class LabOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly labOrdersGateway: LabOrdersGateway,
  ) {}

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
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (booking.doctorId !== doctorId) {
      throw new ApiException(
        MessageCodes.BOOKING_ACCESS_FORBIDDEN,
        'Not authorized to access this booking',
        HttpStatus.FORBIDDEN,
      );
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
        serviceId: dto.serviceId, // Added serviceId to keep track for billing
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

  async getOrderById(id: string) {
    const rawOrder = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        result: true,
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
    });

    if (!rawOrder) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const { booking, ...rest } = rawOrder;
    const order = {
      ...rest,
      booking: booking
        ? { bookingCode: booking.bookingCode, doctor: booking.doctor }
        : undefined,
      patientProfile: booking?.patientProfile,
    };

    return ResponseHelper.success(
      order,
      'LAB.FETCHED_BY_ID',
      'Lab order fetched successfully',
      200,
    );
  }

  /**
   * Technician view list of lab orders that have been paid (PAID) and are ready to perform.
   */
  async getReadyToPerformOrders() {
    const rawOrders = await this.prisma.labOrder.findMany({
      where: {
        status: { in: [LabOrderStatus.PAID, LabOrderStatus.IN_PROGRESS] },
      },
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

  async getTechnicianStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [pending, inProgress, completedToday] = await Promise.all([
      this.prisma.labOrder.count({
        where: { status: LabOrderStatus.PAID },
      }),
      this.prisma.labOrder.count({
        where: { status: LabOrderStatus.IN_PROGRESS },
      }),
      this.prisma.labOrder.count({
        where: {
          status: LabOrderStatus.COMPLETED,
          updatedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ]);

    return ResponseHelper.success(
      { pending, inProgress, completedToday },
      'LAB.TECHNICIAN_STATS',
      'Technician stats fetched',
      200,
    );
  }

  async getTechnicianHistory() {
    const rawOrders = await this.prisma.labOrder.findMany({
      where: {
        status: LabOrderStatus.COMPLETED,
      },
      include: {
        result: true,
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
      orderBy: { updatedAt: 'desc' },
      take: 50,
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
      'LAB.TECHNICIAN_HISTORY',
      'Technician history fetched',
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
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
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

    // Push real-time event to the doctor viewing this booking
    this.labOrdersGateway.broadcastLabResultCompleted(order.bookingId, {
      labOrderId,
      testName: order.testName,
    });

    return ResponseHelper.success(
      updatedOrder,
      'LAB.RESULT_ADDED',
      'Lab result saved',
      200,
    );
  }

  async updateOrderStatus(labOrderId: string, status: LabOrderStatus) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: labOrderId },
    });

    if (!order) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const updatedOrder = await this.prisma.labOrder.update({
      where: { id: labOrderId },
      data: { status },
    });

    return ResponseHelper.success(
      updatedOrder,
      'LAB.STATUS_UPDATED',
      'Lab order status updated',
      200,
    );
  }

  async deleteOrder(doctorId: string, labOrderId: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: labOrderId },
    });

    if (!order) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_NOT_FOUND,
        'Lab order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (order.doctorId !== doctorId) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_DELETE_FORBIDDEN,
        'Only the assigned doctor can delete this order',
        HttpStatus.FORBIDDEN,
      );
    }

    if (order.status === LabOrderStatus.COMPLETED) {
      throw new ApiException(
        MessageCodes.LAB_ORDER_DELETE_COMPLETED,
        'Cannot delete a completed lab order',
        HttpStatus.BAD_REQUEST,
      );
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
