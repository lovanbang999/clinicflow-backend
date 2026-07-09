import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
import { BookingStatus, ServiceOrderStatus, Prisma } from '@prisma/client';
import {
  QueueRecordWithRelations,
  BookingWithRelations,
} from '../database/types/prisma-payload.types';
import { MessageCodes } from '../../common/constants/message-codes.const';
import { ApiException } from '../../common/exceptions/api.exception';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export interface QueueRecordMixed {
  id: string;
  bookingId: string;
  doctorId: string;
  queueDate: Date;
  queuePosition: number;
  estimatedWaitMinutes: number;
  isPreBooked: boolean;
  scheduledTime: string | null;
  createdAt: Date;
  updatedAt: Date;
  calledAt: Date | null;
  completedAt: Date | null;
  booking: {
    id: string;
    bookingCode: string | null;
    bookingDate: Date;
    startTime: string | null;
    endTime: string | null;
    status: BookingStatus;
    patientProfile: {
      id: string;
      userId: string | null;
      fullName: string;
      phone: string | null;
      email: string | null;
      isGuest: boolean;
      patientCode: string | null;
    } | null;
    doctor: {
      id: string;
      email: string;
      fullName: string;
    } | null;
    service: {
      id: string;
      name: string;
      durationMinutes?: number;
      price?: Prisma.Decimal | number;
      maxSlotsPerHour?: number;
    } | null;
    medicalRecord?: {
      id: string;
      isFinalized: boolean;
      chiefComplaint: string | null;
      clinicalFindings: string | null;
      diagnosisCode: string | null;
      diagnosisName: string | null;
      treatmentPlan: string | null;
      doctorNotes: string | null;
      followUpDate: Date | null;
      followUpNote: string | null;
    } | null;
  };
  isVisitServiceOrder?: boolean;
  visitServiceOrderId?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

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
    const booking = await this.bookingRepository.findBookingForQueue(bookingId);

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
    const existingQueue =
      await this.bookingRepository.findQueueByBookingId(bookingId);

    if (existingQueue) {
      throw new ApiException(
        MessageCodes.BOOKING_ALREADY_IN_QUEUE,
        'Booking is already in the queue',
        409,
        'Add to queue failed',
      );
    }

    // Find the latest queue position for the doctor on that date
    const latestPosition = await this.bookingRepository.findLatestQueuePosition(
      booking.doctorId,
      booking.bookingDate,
    );

    const currentPosition = latestPosition + 1;

    // Estimate wait time (naive estimate: active queue size * 30 min)
    const checkedInCount = await this.bookingRepository.countCheckedInQueue(
      booking.doctorId,
      booking.bookingDate,
    );

    const estWaitMinutes = checkedInCount * 30;

    const result = await this.bookingRepository.checkInTransaction(
      bookingId,
      booking.doctorId,
      booking.bookingDate,
      booking.isPreBooked,
      booking.startTime ?? null,
      userId,
      estWaitMinutes,
      currentPosition,
    );

    this.logger.log(
      `Patient checked-in and added to queue successfully: Booking: ${bookingId}, STT: ${currentPosition}, Doctor: ${booking.doctorId}`,
    );

    // Broadcast real-time update
    try {
      this.queueGateway.broadcastQueueUpdate(
        booking.doctorId,
        'CHECK_IN',
        result,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to broadcast queue update for doctor ${booking.doctorId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Recalculate estimated times for the doctor's queue today
    try {
      await this.recalculateEstimatedTimes(
        booking.doctorId,
        booking.bookingDate.toISOString().split('T')[0],
      );
    } catch (err) {
      this.logger.error(
        `Failed to recalculate estimated times for doctor ${booking.doctorId} on ${booking.bookingDate.toISOString()}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Notify staff
    const statusLabels: Record<string, string> = {
      CONFIRMED: 'đã xác nhận',
      CHECKED_IN: 'đã check-in',
      COMPLETED: 'đã hoàn thành',
      CANCELLED: 'đã hủy',
    };

    if (statusLabels[BookingStatus.CHECKED_IN]) {
      try {
        await this.notificationsService.notifyAdmins({
          title: 'Cập nhật lịch hẹn',
          content: `Lịch hẹn của ${booking.patientProfile?.fullName ?? 'Bệnh nhân'} đã vào hàng đợi (STT: ${currentPosition}).`,
          metadata: { bookingId: booking.id, status: BookingStatus.CHECKED_IN },
        });
      } catch (err) {
        this.logger.error(
          `Failed to notify admins for booking check-in ${booking.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }

      try {
        await this.notificationsService.createInAppNotification({
          userId: booking.doctorId,
          title: 'Bệnh nhân mới vào hàng đợi',
          content: `Bệnh nhân ${booking.patientProfile?.fullName ?? 'Bệnh nhân'} (STT: ${currentPosition}) đã check-in và đang đợi khám.`,
          type: 'SYSTEM',
          metadata: { bookingId: booking.id, status: BookingStatus.CHECKED_IN },
        });
      } catch (err) {
        this.logger.error(
          `Failed to notify doctor for booking check-in ${booking.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return result;
  }

  /**
   * Get all queued bookings with filters
   */
  async findAll(filterDto: QueueFilterDto) {
    const { doctorId, date, timeSlot, page = 1, limit = 10 } = filterDto;

    const [queueRecords, total] =
      await this.bookingRepository.findQueueRecordsPaginated(
        doctorId,
        date,
        timeSlot,
        page,
        limit,
      );

    // ──────────────────────────────────────────────────────────────────
    // MIX IN: VisitServiceOrders assigned to this doctor (Nhóm 2)
    // When a receptionist pays the LAB invoice, VSO.status → PAID and
    // queueNumber is assigned. These should surface in the doctor's queue
    // alongside their own CHECKED_IN / IN_PROGRESS bookings.
    // ──────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────
    // MIX IN: VisitServiceOrders assigned to this doctor (Nhóm 2)
    // When a receptionist pays the LAB invoice, VSO.status → PAID and
    // queueNumber is assigned. These should surface in the doctor's queue
    // alongside their own CHECKED_IN / IN_PROGRESS bookings.
    // ──────────────────────────────────────────────────────────────────
    const mixedRecords: QueueRecordMixed[] = [...queueRecords];

    if (doctorId) {
      const startDate = date ? startOfDay(parseISO(date)) : undefined;
      const endDate = date ? endOfDay(parseISO(date)) : undefined;

      const vsoOrders = await this.clinicalRepository.findDoctorSpecialistQueue(
        doctorId,
        startDate,
        endDate,
      );

      // Map each VSO into the same shape as a QueueRecord
      for (const vso of vsoOrders) {
        if (!vso.medicalRecord?.booking) continue;
        const booking = vso.medicalRecord.booking;

        // Override booking status for specialist view to match VSO lifecycle
        let overriddenStatus: BookingStatus = booking.status;
        const status = vso.status;
        if (status === ServiceOrderStatus.PAID) {
          overriddenStatus = BookingStatus.CHECKED_IN;
        } else if (status === ServiceOrderStatus.IN_PROGRESS) {
          overriddenStatus = BookingStatus.IN_PROGRESS;
        } else if (status === ServiceOrderStatus.COMPLETED) {
          overriddenStatus = BookingStatus.COMPLETED;
        }

        mixedRecords.push({
          id: `vso-${vso.id}`, // synthetic id
          bookingId: booking.id,
          doctorId: doctorId,
          queueDate: booking.bookingDate,
          queuePosition: vso.queueNumber ?? 99999,
          estimatedWaitMinutes: 0,
          isPreBooked: false,
          scheduledTime: null,
          createdAt: vso.createdAt,
          updatedAt: vso.updatedAt,
          calledAt: null,
          completedAt: null,
          booking: {
            ...booking,
            status: overriddenStatus,
            service: vso.service,
          },
          // Custom flags for Frontend routing
          isVisitServiceOrder: true,
          visitServiceOrderId: vso.id,
        });
      }
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

    return {
      queueRecords: sortedRecords,
      pagination: {
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
  async findByBookingId(bookingId: string): Promise<QueueRecordWithRelations> {
    const queueRecord =
      await this.bookingRepository.findQueueByBookingId(bookingId);

    if (!queueRecord) {
      // Fallback: If no BookingQueue record exists (e.g. for direct-service walk-ins that bypassed checkIn),
      // we can construct a synthetic QueueRecord if the booking exists.
      const booking =
        await this.bookingRepository.findBookingWithRelations(bookingId);

      if (!booking) {
        throw new ApiException(
          MessageCodes.QUEUE_NOT_FOUND,
          'Queue record not found',
          404,
          'Queue retrieval failed',
        );
      }

      // Return synthetic queue record
      return {
        id: `synth-${booking.id}`,
        bookingId: booking.id,
        doctorId: booking.doctorId,
        queueDate: booking.bookingDate,
        queuePosition: 0,
        estimatedWaitMinutes: 0,
        isPreBooked: booking.isPreBooked,
        scheduledTime: booking.startTime,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        calledAt: null,
        completedAt: null,
        booking,
      };
    }

    return queueRecord;
  }

  /**
   * Get queue statistics
   */
  async getStatistics(doctorId?: string, date?: string) {
    const stats = await this.bookingRepository.getQueueStatistics(
      doctorId,
      date ? new Date(date) : undefined,
    );

    return {
      totalQueued: stats.totalQueued,
      averageWaitTimeMinutes: Math.round(stats.avgWaitTime ?? 0),
      longestQueuePosition: stats.longestQueue || 0,
    };
  }

  /**
   * Manually promote a booking from queue (by RECEPTIONIST/ADMIN)
   */
  async promoteManually(promoteDto: PromoteQueueDto, promotedBy: string) {
    const { bookingId, reason } = promoteDto;

    // Get queue record (will throw if not found)
    const queueRecord = await this.findByBookingId(bookingId);

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
    const confirmedCount =
      await this.bookingRepository.countConfirmedBookingsForSlot(
        queueRecord.booking.doctorId,
        new Date(queueRecord.booking.bookingDate),
        queueRecord.booking.startTime ?? '',
      );
    const maxSlotsPerHour = queueRecord.booking.service?.maxSlotsPerHour ?? 1;
    const isSlotAvailable = confirmedCount < maxSlotsPerHour;

    if (!isSlotAvailable) {
      throw new ApiException(
        MessageCodes.QUEUE_SLOT_FULL,
        'Slot is still full. Cannot promote at this time.',
        400,
        'Queue promotion failed',
      );
    }

    // Promote booking
    const resultBooking = await this.bookingRepository.promoteQueueTransaction(
      bookingId,
      promotedBy,
      reason || 'Manual promotion by staff',
    );

    if (!resultBooking) {
      throw new ApiException(
        MessageCodes.QUEUE_NOT_FOUND,
        'Queue record not found',
        404,
        'Queue promotion failed',
      );
    }

    this.logger.log(
      `Successfully promoted booking ${bookingId} manually by user ${promotedBy}`,
    );

    // Broadcast the promotion event (non-blocking)
    try {
      this.queueGateway.broadcastQueueUpdate(
        queueRecord.booking.doctorId,
        'PROMOTED',
        resultBooking,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast manual promotion for booking ${bookingId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return resultBooking;
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
    const firstInQueue = await this.bookingRepository.findFirstInQueue(
      doctorId,
      new Date(bookingDate),
      timeSlot,
    );

    if (!firstInQueue) {
      return false; // No one in queue
    }

    // Check if slot is available
    const confirmedCount =
      await this.bookingRepository.countConfirmedBookingsForSlot(
        doctorId,
        new Date(bookingDate),
        timeSlot,
      );
    const maxSlotsPerHour = firstInQueue.booking.service?.maxSlotsPerHour ?? 1;
    const isAvailable = confirmedCount < maxSlotsPerHour;

    if (!isAvailable) {
      return false; // Slot still full
    }

    // Promote the first booking in queue
    const resultBooking = await this.bookingRepository.promoteQueueTransaction(
      firstInQueue.bookingId,
      'system',
      'Auto-promoted from queue',
    );

    this.logger.log(
      `Successfully auto-promoted booking ${firstInQueue.bookingId} from queue`,
    );

    // Broadcast the promotion event (non-blocking)
    try {
      this.queueGateway.broadcastQueueUpdate(
        doctorId,
        'PROMOTED',
        resultBooking,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast auto-promotion for booking ${firstInQueue.bookingId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return true;
  }

  /**
   * Remove from queue (when booking is cancelled)
   */
  async removeFromQueue(bookingId: string) {
    const queueRecord =
      await this.bookingRepository.findQueueByBookingId(bookingId);

    if (!queueRecord) {
      return; // Not in queue, nothing to do
    }

    await this.bookingRepository.removeFromQueueAndShiftTransaction(bookingId);

    this.logger.log(`Successfully removed booking ${bookingId} from queue`);

    // Broadcast queue update since positions shifted (non-blocking)
    try {
      this.queueGateway.broadcastQueueUpdate(queueRecord.doctorId, 'UPDATE', {
        bookingId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to broadcast queue update after removing booking ${bookingId}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Send queue promotion notification email
   */
  private async sendQueuePromotionNotification(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      const email = booking.patientProfile?.email;
      if (!email) return;
      await this.notificationsService.sendQueuePromotion({
        bookingId: booking.id,
        patientId: booking.patientProfile?.userId ?? undefined,
        patientName: booking.patientProfile?.fullName ?? 'Bệnh nhân',
        patientEmail: email,
        doctorName: booking.doctor?.fullName ?? 'Bác sĩ',
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
      this.logger.error(
        'Failed to send queue promotion notification:',
        error instanceof Error ? error.stack : String(error),
      );
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
    const parsedDate = new Date(bookingDate);

    // Fetch all pre-bookings still active today (to find gaps)
    const preBookings =
      await this.bookingRepository.findActivePreBookingsForRecalculation(
        doctorId,
        parsedDate,
      );

    // Fetch walk-in queue records for this doctor today
    const walkInQueues =
      await this.bookingRepository.findActiveWalkInQueueForRecalculation(
        doctorId,
        parsedDate,
      );

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

      await this.bookingRepository.updateBookingEstimatedTime(
        record.booking.id,
        estTime,
      );

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
