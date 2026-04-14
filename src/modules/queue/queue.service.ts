import {
  ApiResponse,
  ResponseHelper,
} from '../../common/interfaces/api-response.interface';
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  IBookingRepository,
  I_BOOKING_REPOSITORY,
} from '../database/interfaces/booking.repository.interface';
import {
  IClinicalRepository,
  I_CLINICAL_REPOSITORY,
} from '../database/interfaces/clinical.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PromoteQueueDto } from './dto/promote-queue.dto';
import { QueueFilterDto } from './dto/queue-filter.dto';
import { QueueGateway } from './queue.gateway';
import { BookingStatus, Prisma, ServiceOrderStatus } from '@prisma/client';
import {
  BookingInclude,
  BookingWithRelations,
  QueueRecordWithRelations,
} from '../database/types/prisma-payload.types';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

@Injectable()
export class QueueService {
  constructor(
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    private readonly notificationsService: NotificationsService,
    private readonly queueGateway: QueueGateway,
  ) {}

  /**
   * Add a booking to the queue (Check-in)
   * This logic is extracted from BookingsService to allow shared use.
   */
  async addToQueue(bookingId: string, userId: string) {
    const booking = await this.bookingRepository.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        patientProfile: true,
      },
    });

    if (!booking) {
      throw new ApiException(
        MessageCodes.BOOKING_NOT_FOUND,
        'Booking not found',
        404,
        'Add to queue failed',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ApiException(
        MessageCodes.BOOKING_INVALID_STATUS,
        'Only confirmed bookings can be added to queue',
        400,
        'Add to queue failed',
      );
    }

    // Check if it already has a queue record
    const existingQueue = await this.bookingRepository.findQueueUnique({
      where: { bookingId },
    });

    if (existingQueue) {
      throw new ApiException(
        MessageCodes.BOOKING_ALREADY_IN_QUEUE,
        'Booking is already in the queue',
        409,
        'Add to queue failed',
      );
    }

    // Find the latest queue position for the doctor on that date
    const latestQueue = await this.bookingRepository.findQueueFirst({
      where: {
        doctorId: booking.doctorId,
        queueDate: booking.bookingDate,
      },
      orderBy: {
        queuePosition: 'desc',
      },
      select: {
        queuePosition: true,
      },
    });

    const currentPosition = latestQueue ? latestQueue.queuePosition + 1 : 1;

    // Estimate wait time (naive estimate: active queue size * 30 min)
    const checkedInCount = await this.bookingRepository.countQueue({
      where: {
        doctorId: booking.doctorId,
        queueDate: booking.bookingDate,
        booking: { status: BookingStatus.CHECKED_IN },
      },
    });

    const estWaitMinutes = checkedInCount * 30;

    const result = await this.bookingRepository.transaction(async (tx) => {
      // 1. Update Booking status
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
        include: BookingInclude,
      });

      // 2. Create history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: BookingStatus.CONFIRMED,
          newStatus: BookingStatus.CHECKED_IN,
          changedById: userId,
          reason: 'Patient added to queue (Auto or Manual Check-in)',
        },
      });

      // 3. Create Queue Record
      const queueRecord = await tx.bookingQueue.create({
        data: {
          bookingId,
          doctorId: booking.doctorId,
          queueDate: booking.bookingDate,
          queuePosition: currentPosition,
          estimatedWaitMinutes: estWaitMinutes,
          isPreBooked: booking.isPreBooked,
          scheduledTime: booking.startTime ?? null,
        },
      });
      return { booking: updatedBooking, queue: queueRecord };
    });

    // Broadcast real-time update
    this.queueGateway.broadcastQueueUpdate(
      booking.doctorId,
      'CHECK_IN',
      result,
    );

    // Recalculate estimated times for the doctor's queue today
    await this.recalculateEstimatedTimes(
      booking.doctorId,
      booking.bookingDate.toISOString().split('T')[0],
    );

    // Notify staff
    const statusLabels: Record<string, string> = {
      CONFIRMED: 'đã xác nhận',
      CHECKED_IN: 'đã check-in',
      COMPLETED: 'đã hoàn thành',
      CANCELLED: 'đã hủy',
    };

    if (statusLabels[BookingStatus.CHECKED_IN]) {
      await this.notificationsService.notifyAdmins({
        title: 'Cập nhật lịch hẹn',
        content: `Lịch hẹn của ${booking.patientProfile.fullName} đã vào hàng đợi (STT: ${currentPosition}).`,
        metadata: { bookingId: booking.id, status: BookingStatus.CHECKED_IN },
      });
    }

    return ResponseHelper.success(
      result,
      MessageCodes.BOOKING_CHECKED_IN,
      'Patient added to queue successfully',
      200,
    );
  }

  /**
   * Get all queued bookings with filters
   */
  async findAll(filterDto: QueueFilterDto) {
    const { doctorId, date, timeSlot, page = 1, limit = 10 } = filterDto;

    // Build booking where clause properly
    const bookingWhere: Prisma.BookingWhereInput = {
      status: {
        in: [
          BookingStatus.CHECKED_IN,
          BookingStatus.IN_PROGRESS,
          BookingStatus.COMPLETED,
        ],
      },
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
      this.bookingRepository.findQueueMany({
        where,
        include: {
          booking: {
            include: {
              ...BookingInclude,
              medicalRecord: {
                select: {
                  id: true,
                  isFinalized: true,
                  chiefComplaint: true,
                  clinicalFindings: true,
                  diagnosisCode: true,
                  diagnosisName: true,
                  treatmentPlan: true,
                  doctorNotes: true,
                  followUpDate: true,
                  followUpNote: true,
                },
              },
            },
          },
        },
        orderBy: [
          { booking: { bookingDate: 'asc' } },
          { queuePosition: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.bookingRepository.countQueue({ where }),
    ]);

    // ──────────────────────────────────────────────────────────────────
    // MIX IN: VisitServiceOrders assigned to this doctor (Nhóm 2)
    // When a receptionist pays the LAB invoice, VSO.status → PAID and
    // queueNumber is assigned. These should surface in the doctor's queue
    // alongside their own CHECKED_IN / IN_PROGRESS bookings.
    // ──────────────────────────────────────────────────────────────────
    type QueueRecordMixed = (typeof queueRecords)[0] & {
      isVisitServiceOrder?: boolean;
      visitServiceOrderId?: string;
    };

    let mixedRecords: QueueRecordMixed[] = [...queueRecords];

    if (doctorId) {
      const vsoStatusFilter = ['PAID', 'IN_PROGRESS'];
      const vsoOrders = await this.clinicalRepository.findManyVisitServiceOrder(
        {
          where: {
            performedBy: doctorId,
            status: { in: vsoStatusFilter as ('PAID' | 'IN_PROGRESS')[] },
            ...(date
              ? {
                  createdAt: {
                    gte: startOfDay(parseISO(date)),
                    lte: endOfDay(parseISO(date)),
                  },
                }
              : {}),
          },
          include: {
            service: { select: { id: true, name: true } },
            medicalRecord: {
              include: {
                booking: {
                  include: {
                    ...BookingInclude,
                    medicalRecord: {
                      select: {
                        id: true,
                        isFinalized: true,
                        chiefComplaint: true,
                        clinicalFindings: true,
                        diagnosisCode: true,
                        diagnosisName: true,
                        treatmentPlan: true,
                        doctorNotes: true,
                        followUpDate: true,
                        followUpNote: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { queueNumber: 'asc' },
        },
      );

      // Map each VSO into the same shape as a QueueRecord
      const vsoAsQueueRecords: QueueRecordMixed[] = vsoOrders
        .filter((vso) => !!vso.medicalRecord?.booking)
        .map((vso) => {
          const booking = vso.medicalRecord.booking;

          // Override booking status for specialist view to match VSO lifecycle
          let overriddenStatus: BookingStatus = booking.status;
          const status = vso.status as string;
          if (status === ServiceOrderStatus.PAID) {
            overriddenStatus = BookingStatus.CHECKED_IN;
          } else if (status === ServiceOrderStatus.IN_PROGRESS) {
            overriddenStatus = BookingStatus.IN_PROGRESS;
          } else if (status === ServiceOrderStatus.COMPLETED) {
            overriddenStatus = BookingStatus.COMPLETED;
          }

          return {
            id: `vso-${vso.id}`, // synthetic id
            bookingId: booking.id,
            doctorId: doctorId,
            queueDate: booking.bookingDate, // keep as Date to satisfy Prisma type
            queuePosition: vso.queueNumber ?? 99999,
            estimatedWaitMinutes: 0,
            isPreBooked: false,
            scheduledTime: null,
            createdAt: vso.createdAt,
            updatedAt: vso.updatedAt,
            calledAt: null,
            completedAt: null, // required by BookingQueue Prisma type
            booking: {
              ...booking,
              status: overriddenStatus,
              service: vso.service, // Use the specific specialist service
            },
            // Custom flags for Frontend routing
            isVisitServiceOrder: true,
            visitServiceOrderId: vso.id,
          } as unknown as QueueRecordMixed;
        });

      mixedRecords = [...queueRecords, ...vsoAsQueueRecords];
    }

    // Priority sort (application layer):
    // 1. Pre-booking with scheduledTime <= now → highest (patient is due)
    // 2. Walk-in (no fixed time) → medium
    // 3. Future pre-bookings → lowest
    const nowTimeStr = new Date().toTimeString().slice(0, 5); // 'HH:MM'
    const sortedRecords = [...mixedRecords].sort((a, b) => {
      const priorityOf = (r: QueueRecordMixed): number => {
        if (r.isVisitServiceOrder) return 1; // Same priority as walk-in
        if (r.isPreBooked && r.scheduledTime && r.scheduledTime <= nowTimeStr)
          return 0;
        if (!r.isPreBooked) return 1;
        return 2;
      };

      const pa = priorityOf(a);
      const pb = priorityOf(b);
      if (pa !== pb) return pa - pb;
      if (pa !== 1) {
        return (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '');
      }
      return a.queuePosition - b.queuePosition;
    });

    return ResponseHelper.success(
      {
        queueRecords: sortedRecords,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      MessageCodes.QUEUE_LIST_RETRIEVED,
      'Queue records retrieved successfully',
      200,
    );
  }

  /**
   * Get queue by booking ID
   */
  async findByBookingId(
    bookingId: string,
  ): Promise<ApiResponse<QueueRecordWithRelations>> {
    const queueRecord = await this.bookingRepository.findQueueUnique({
      where: { bookingId },
      include: {
        booking: {
          include: BookingInclude,
        },
      },
    });

    if (!queueRecord) {
      throw new ApiException(
        MessageCodes.QUEUE_NOT_FOUND,
        'Queue record not found',
        404,
        'Queue retrieval failed',
      );
    }

    return ResponseHelper.success(
      queueRecord,
      MessageCodes.QUEUE_RETRIEVED,
      'Queue record retrieved successfully',
      200,
    );
  }

  /**
   * Get queue statistics
   */
  async getStatistics(doctorId?: string, date?: string) {
    // Build booking where clause properly
    const bookingWhere: Prisma.BookingWhereInput = {
      status: { in: [BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS] },
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
      this.bookingRepository.countQueue({ where }),
      this.bookingRepository.aggregateQueue({
        where,
        _avg: {
          estimatedWaitMinutes: true,
        },
      }),
      this.bookingRepository.findQueueFirst({
        where,
        orderBy: {
          queuePosition: 'desc',
        },
        select: {
          queuePosition: true,
        },
      }),
    ]);

    return ResponseHelper.success(
      {
        totalQueued,
        averageWaitTimeMinutes: Math.round(
          avgWaitTime._avg?.estimatedWaitMinutes ?? 0,
        ),
        longestQueuePosition: longestQueue?.queuePosition || 0,
      },
      MessageCodes.QUEUE_STATISTICS_RETRIEVED,
      'Queue statistics retrieved successfully',
      200,
    );
  }

  /**
   * Manually promote a booking from queue (by RECEPTIONIST/ADMIN)
   */
  async promoteManually(promoteDto: PromoteQueueDto, promotedBy: string) {
    const { bookingId, reason } = promoteDto;

    // Get queue record (will throw if not found)
    const queueResponse = await this.findByBookingId(bookingId);
    const queueRecord = queueResponse.data as QueueRecordWithRelations;

    if (!queueRecord) {
      throw new ApiException(
        MessageCodes.QUEUE_NOT_FOUND,
        'Queue record not found',
        404,
        'Queue promotion failed',
      );
    }

    // Check if booking is actually queued
    if (queueRecord.booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Booking is not in queue');
    }

    // Check if slot is now available
    const isSlotAvailable = await this.checkSlotAvailability(
      queueRecord.booking.doctorId,
      queueRecord.booking.bookingDate.toISOString().split('T')[0],
      queueRecord.booking.startTime ?? '',
      queueRecord.booking.service?.maxSlotsPerHour ?? 1,
    );

    if (!isSlotAvailable) {
      throw new ApiException(
        MessageCodes.QUEUE_SLOT_FULL,
        'Slot is still full. Cannot promote at this time.',
        400,
        'Queue promotion failed',
      );
    }

    // Promote booking
    const result = await this.promoteBooking(
      bookingId,
      promotedBy,
      reason || 'Manual promotion by staff',
    );

    // Broadcast the promotion event
    this.queueGateway.broadcastQueueUpdate(
      queueRecord.booking.doctorId,
      'PROMOTED',
      result.booking,
    );

    return ResponseHelper.success(
      result.booking,
      MessageCodes.QUEUE_PROMOTED,
      'Booking promoted from queue successfully',
      200,
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
    const firstInQueue = await this.bookingRepository.findQueueFirst({
      where: {
        booking: {
          doctorId,
          bookingDate: new Date(bookingDate),
          startTime: timeSlot,
          status: BookingStatus.CHECKED_IN,
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
                maxSlotsPerHour: true,
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
      firstInQueue.booking.service?.maxSlotsPerHour ?? 1,
    );

    if (!isAvailable) {
      return false; // Slot still full
    }

    // Promote the first booking in queue
    const result = await this.promoteBooking(
      firstInQueue.bookingId,
      'system',
      'Auto-promoted from queue',
    );

    this.queueGateway.broadcastQueueUpdate(
      doctorId,
      'PROMOTED',
      result.booking,
    );

    return true;
  }

  /**
   * Remove from queue (when booking is cancelled)
   */
  async removeFromQueue(bookingId: string) {
    const queueRecord = await this.bookingRepository.findQueueUnique({
      where: { bookingId },
      include: {
        booking: true,
      },
    });

    if (!queueRecord) {
      return; // Not in queue, nothing to do
    }

    await this.bookingRepository.transaction(async (tx) => {
      // Delete queue record
      await tx.bookingQueue.delete({
        where: { bookingId },
      });

      // Shift remaining queue positions
      await this.shiftQueuePositions(
        tx,
        queueRecord.booking.doctorId,
        queueRecord.booking.bookingDate.toISOString().split('T')[0],
        queueRecord.booking.startTime ?? '',
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
  ): Promise<{ booking: BookingWithRelations }> {
    const result = await this.bookingRepository.transaction(async (tx) => {
      // Get queue record
      const queueRecord = await tx.bookingQueue.findUnique({
        where: { bookingId },
        include: {
          booking: {
            include: BookingInclude,
          },
        },
      });

      if (!queueRecord) {
        throw new ApiException(
          MessageCodes.QUEUE_NOT_FOUND,
          'Queue record not found',
          404,
          'Queue promotion failed',
        );
      }

      // Update booking status to CONFIRMED
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
        },
        include: BookingInclude,
      });

      // Create status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: BookingStatus.CHECKED_IN,
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
        queueRecord.booking.startTime ?? '',
        queueRecord.queuePosition,
      );

      return {
        booking: updatedBooking,
      };
    });

    // Send queue promotion notification (non-blocking)
    this.sendQueuePromotionNotification(result.booking).catch((error) => {
      console.error('Failed to send queue promotion notification:', error);
    });

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
          status: BookingStatus.CHECKED_IN,
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
    const confirmedBookings = await this.bookingRepository.count({
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

  /**
   * Send queue promotion notification email
   */
  private async sendQueuePromotionNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      const email = booking.patientProfile.email;
      if (!email) return;
      await this.notificationsService.sendQueuePromotion({
        bookingId: booking.id,
        patientId: booking.patientProfile.userId ?? undefined,
        patientName: booking.patientProfile.fullName,
        patientEmail: email,
        doctorName: booking.doctor.fullName,
        serviceName: booking.service?.name ?? 'Tư vấn (Chưa xác định)',
        bookingDate: this.formatDate(booking.bookingDate),
        startTime: booking.startTime ?? '',
        endTime: booking.endTime ?? '',
        duration: booking.service?.durationMinutes ?? 0,
        status: booking.status,
        price: booking.service?.price
          ? Number(booking.service.price)
          : undefined,
      });
    } catch (error) {
      console.error('Failed to send queue promotion notification:', error);
    }
  }

  /**
   * Recalculate estimatedTime for all walk-in patients of a doctor on a given date.
   * Called after each check-in to keep estimated times accurate.
   */
  async recalculateEstimatedTimes(
    doctorId: string,
    bookingDate: string,
  ): Promise<void> {
    // Fetch all pre-bookings still active today (to find gaps)
    const preBookings = await this.bookingRepository.findMany({
      where: {
        doctorId,
        bookingDate: new Date(bookingDate),
        isPreBooked: true,
        startTime: { not: null },
        status: {
          notIn: [
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW,
            BookingStatus.COMPLETED,
          ],
        },
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    // Fetch walk-in queue records for this doctor today
    const walkInQueues = await this.bookingRepository.findQueueMany({
      where: {
        doctorId,
        queueDate: new Date(bookingDate),
        isPreBooked: false,
        booking: {
          status: {
            notIn: [
              BookingStatus.CANCELLED,
              BookingStatus.NO_SHOW,
              BookingStatus.COMPLETED,
            ],
          },
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            service: { select: { durationMinutes: true } },
          },
        },
      },
      orderBy: { queuePosition: 'asc' },
    });

    if (walkInQueues.length === 0) return;

    // Find available gaps between pre-bookings or use end-of-day
    const now = new Date();
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const lastPreEnd = preBookings.at(-1)?.endTime ?? nowTimeStr;

    let cursor = new Date(bookingDate);
    const [hh, mm] = lastPreEnd.split(':').map(Number);
    cursor.setHours(hh, mm, 0, 0);

    for (const record of walkInQueues) {
      const estTime = new Date(cursor);
      const duration = record.booking.service?.durationMinutes ?? 30;

      await this.bookingRepository.update({
        where: { id: record.booking.id },
        data: { estimatedTime: estTime },
      });

      cursor = new Date(cursor.getTime() + duration * 60 * 1000);
    }
  }

  /**
   * Format date to readable string
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
