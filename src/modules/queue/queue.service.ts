import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromoteQueueDto } from './dto/promote-queue.dto';
import { QueueFilterDto } from './dto/queue-filter.dto';
import { BookingStatus, Prisma } from '@prisma/client';

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all queued bookings with filters
   */
  async findAll(filterDto: QueueFilterDto) {
    const { doctorId, date, timeSlot, page = 1, limit = 10 } = filterDto;

    // Build booking where clause properly
    const bookingWhere: Prisma.BookingWhereInput = {
      status: BookingStatus.QUEUED,
    };

    if (doctorId) {
      bookingWhere.doctorId = doctorId;
    }

    if (date) {
      bookingWhere.bookingDate = new Date(date);
    }

    if (timeSlot) {
      bookingWhere.startTime = timeSlot;
    }

    const where: Prisma.BookingQueueWhereInput = {
      booking: bookingWhere,
    };

    const [queueRecords, total] = await Promise.all([
      this.prisma.bookingQueue.findMany({
        where,
        include: {
          booking: {
            include: {
              patient: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
              doctor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              service: {
                select: {
                  id: true,
                  name: true,
                  durationMinutes: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: [
          { booking: { bookingDate: 'asc' } },
          { booking: { startTime: 'asc' } },
          { queuePosition: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bookingQueue.count({ where }),
    ]);

    return {
      data: queueRecords,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get queue by booking ID
   */
  async findByBookingId(bookingId: string) {
    const queueRecord = await this.prisma.bookingQueue.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            doctor: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
                durationMinutes: true,
                price: true,
                maxSlotsPerHour: true, // Add this field
              },
            },
          },
        },
      },
    });

    if (!queueRecord) {
      throw new NotFoundException('Queue record not found');
    }

    return queueRecord;
  }

  /**
   * Get queue statistics
   */
  async getStatistics(doctorId?: string, date?: string) {
    // Build booking where clause properly
    const bookingWhere: Prisma.BookingWhereInput = {
      status: BookingStatus.QUEUED,
    };

    if (doctorId) {
      bookingWhere.doctorId = doctorId;
    }

    if (date) {
      bookingWhere.bookingDate = new Date(date);
    }

    const where: Prisma.BookingQueueWhereInput = {
      booking: bookingWhere,
    };

    const [totalQueued, avgWaitTime, longestQueue] = await Promise.all([
      this.prisma.bookingQueue.count({ where }),
      this.prisma.bookingQueue.aggregate({
        where,
        _avg: {
          estimatedWaitMinutes: true,
        },
      }),
      this.prisma.bookingQueue.findFirst({
        where,
        orderBy: {
          queuePosition: 'desc',
        },
        select: {
          queuePosition: true,
        },
      }),
    ]);

    return {
      totalQueued,
      averageWaitTimeMinutes: Math.round(
        avgWaitTime._avg.estimatedWaitMinutes || 0,
      ),
      longestQueuePosition: longestQueue?.queuePosition || 0,
    };
  }

  /**
   * Manually promote a booking from queue (by RECEPTIONIST/ADMIN)
   */
  async promoteManually(promoteDto: PromoteQueueDto, promotedBy: string) {
    const { bookingId, reason } = promoteDto;

    // Get queue record
    const queueRecord = await this.findByBookingId(bookingId);

    // Check if booking is actually queued
    if (queueRecord.booking.status !== BookingStatus.QUEUED) {
      throw new BadRequestException('Booking is not in queue');
    }

    // Check if slot is now available
    const isSlotAvailable = await this.checkSlotAvailability(
      queueRecord.booking.doctorId,
      queueRecord.booking.bookingDate.toISOString().split('T')[0],
      queueRecord.booking.startTime,
      queueRecord.booking.service.maxSlotsPerHour,
    );

    if (!isSlotAvailable) {
      throw new BadRequestException(
        'Slot is still full. Cannot promote at this time.',
      );
    }

    // Promote booking
    return this.promoteBooking(
      bookingId,
      promotedBy,
      reason || 'Manual promotion by staff',
    );
  }

  /**
   * Auto-promote from queue when a slot becomes available
   */
  async autoPromote(
    doctorId: string,
    bookingDate: string,
    timeSlot: string,
  ): Promise<boolean> {
    // Find first booking in queue for this slot
    const firstInQueue = await this.prisma.bookingQueue.findFirst({
      where: {
        booking: {
          doctorId,
          bookingDate: new Date(bookingDate),
          startTime: timeSlot,
          status: BookingStatus.QUEUED,
        },
      },
      orderBy: {
        queuePosition: 'asc',
      },
      include: {
        booking: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                durationMinutes: true,
                price: true,
                maxSlotsPerHour: true, // Add this field
              },
            },
          },
        },
      },
    });

    if (!firstInQueue) {
      return false; // No one in queue
    }

    // Check if slot is available
    const isAvailable = await this.checkSlotAvailability(
      doctorId,
      bookingDate,
      timeSlot,
      firstInQueue.booking.service.maxSlotsPerHour,
    );

    if (!isAvailable) {
      return false; // Slot still full
    }

    // Promote the first booking in queue
    await this.promoteBooking(
      firstInQueue.bookingId,
      'system',
      'Auto-promoted from queue',
    );

    return true;
  }

  /**
   * Remove from queue (when booking is cancelled)
   */
  async removeFromQueue(bookingId: string) {
    const queueRecord = await this.prisma.bookingQueue.findUnique({
      where: { bookingId },
      include: {
        booking: true,
      },
    });

    if (!queueRecord) {
      return; // Not in queue, nothing to do
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete queue record
      await tx.bookingQueue.delete({
        where: { bookingId },
      });

      // Shift remaining queue positions
      await this.shiftQueuePositions(
        tx,
        queueRecord.booking.doctorId,
        queueRecord.booking.bookingDate.toISOString().split('T')[0],
        queueRecord.booking.startTime,
        queueRecord.queuePosition,
      );
    });
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Promote a booking from queue to confirmed
   */
  private async promoteBooking(
    bookingId: string,
    promotedBy: string,
    reason: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Get queue record
      const queueRecord = await tx.bookingQueue.findUnique({
        where: { bookingId },
        include: {
          booking: {
            include: {
              patient: true,
              doctor: true,
              service: true,
            },
          },
        },
      });

      if (!queueRecord) {
        throw new NotFoundException('Queue record not found');
      }

      // Update booking status to CONFIRMED
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
        },
        include: {
          patient: true,
          doctor: true,
          service: true,
        },
      });

      // Create status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: BookingStatus.QUEUED,
          newStatus: BookingStatus.CONFIRMED,
          changedById: promotedBy,
          reason,
        },
      });

      // Delete queue record
      await tx.bookingQueue.delete({
        where: { bookingId },
      });

      // Shift remaining queue positions
      await this.shiftQueuePositions(
        tx,
        queueRecord.booking.doctorId,
        queueRecord.booking.bookingDate.toISOString().split('T')[0],
        queueRecord.booking.startTime,
        queueRecord.queuePosition,
      );

      return {
        booking: updatedBooking,
        message: 'Booking promoted from queue successfully',
      };
    });

    // TODO: Send notification to patient
    // await this.notificationService.sendQueuePromotion(result.booking);

    return result;
  }

  /**
   * Shift queue positions after removal
   */
  private async shiftQueuePositions(
    tx: Prisma.TransactionClient,
    doctorId: string,
    bookingDate: string,
    timeSlot: string,
    removedPosition: number,
  ) {
    // Get all bookings after the removed position
    const affectedQueues = await tx.bookingQueue.findMany({
      where: {
        booking: {
          doctorId,
          bookingDate: new Date(bookingDate),
          startTime: timeSlot,
          status: BookingStatus.QUEUED,
        },
        queuePosition: {
          gt: removedPosition,
        },
      },
    });

    // Update each queue position
    for (const queue of affectedQueues) {
      await tx.bookingQueue.update({
        where: { id: queue.id },
        data: {
          queuePosition: queue.queuePosition - 1,
          estimatedWaitMinutes: queue.estimatedWaitMinutes - 30, // Assume 30 min reduction
        },
      });
    }
  }

  /**
   * Check if slot is available
   */
  private async checkSlotAvailability(
    doctorId: string,
    bookingDate: string,
    timeSlot: string,
    maxSlotsPerHour: number,
  ): Promise<boolean> {
    const confirmedBookings = await this.prisma.booking.count({
      where: {
        doctorId,
        bookingDate: new Date(bookingDate),
        startTime: timeSlot,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
          ],
        },
      },
    });

    return confirmedBookings < maxSlotsPerHour;
  }
}
