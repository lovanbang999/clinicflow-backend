import { Injectable } from '@nestjs/common';
import {
  Booking,
  BookingQueue,
  BookingStatus,
  DayOfWeek,
  DoctorBreakTime,
  DoctorOffDay,
  DoctorScheduleSlot,
  DoctorWorkingHours,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { TransactionClient } from '../interfaces/clinical.repository.interface';
import {
  BookingDetail,
  BookingWithDuration,
  BookingWithRelations,
  QueueRecordWithRelations,
} from '../types/prisma-payload.types';
import { IBookingRepository } from '../interfaces/booking.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';

const bookingInclude = {
  patientProfile: {
    select: {
      id: true,
      userId: true,
      fullName: true,
      phone: true,
      email: true,
      isGuest: true,
      patientCode: true,
    },
  },
  doctor: {
    select: { id: true, email: true, fullName: true },
  },
  service: {
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      price: true,
    },
  },
};

@Injectable()
export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  countBooking(args: Prisma.BookingCountArgs): Promise<number> {
    return this.prisma.booking.count(args);
  }
  findFirstBooking<T extends Prisma.BookingFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindFirstArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null> {
    return this.prisma.booking.findFirst(
      args,
    ) as Promise<Prisma.BookingGetPayload<T> | null>;
  }
  findManyBooking<T extends Prisma.BookingFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindManyArgs>,
  ): Promise<Prisma.BookingGetPayload<T>[]> {
    return this.prisma.booking.findMany(args) as Promise<
      Prisma.BookingGetPayload<T>[]
    >;
  }
  findUniqueBooking<T extends Prisma.BookingFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindUniqueArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null> {
    return this.prisma.booking.findUnique(
      args,
    ) as Promise<Prisma.BookingGetPayload<T> | null>;
  }
  updateBooking(args: Prisma.BookingUpdateArgs): Promise<Booking> {
    return this.prisma.booking.update(args);
  }
  createBooking(args: Prisma.BookingCreateArgs): Promise<Booking> {
    return this.prisma.booking.create(args);
  }
  groupByBooking(args: Prisma.BookingGroupByArgs): Promise<unknown[]> {
    return this.prisma.booking.groupBy(args as never) as Promise<unknown[]>;
  }
  aggregateBooking(
    args: Prisma.BookingAggregateArgs,
  ): Promise<Prisma.GetBookingAggregateType<Prisma.BookingAggregateArgs>> {
    return this.prisma.booking.aggregate(args);
  }
  deleteBooking(args: Prisma.BookingDeleteArgs): Promise<Booking> {
    return this.prisma.booking.delete(args);
  }

  async countBookingsByService(
    serviceId: string,
    statuses?: string[],
  ): Promise<number> {
    const where: Prisma.BookingWhereInput = { serviceId };
    if (statuses && statuses.length > 0) {
      where.status = { in: statuses as BookingStatus[] };
    }
    return this.prisma.booking.count({ where });
  }

  async countActiveAppointmentsGroup(startDate: Date): Promise<number> {
    return this.prisma.booking.count({
      where: {
        bookingDate: { gte: startDate },
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ],
        },
      },
    });
  }

  // === Schedules (Working Hours, Breaks, Off Days, Slots) ===
  async findDoctorWorkingHours(
    doctorId: string,
    dayOfWeek?: DayOfWeek,
  ): Promise<DoctorWorkingHours | null> {
    if (dayOfWeek) {
      return this.prisma.doctorWorkingHours.findUnique({
        where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
      });
    }
    return this.prisma.doctorWorkingHours.findFirst({ where: { doctorId } });
  }

  async findWorkingHoursList(doctorId: string): Promise<DoctorWorkingHours[]> {
    return this.prisma.doctorWorkingHours.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async createDoctorWorkingHours(
    data: Prisma.DoctorWorkingHoursCreateInput,
  ): Promise<DoctorWorkingHours> {
    return this.prisma.doctorWorkingHours.create({ data });
  }

  async updateDoctorWorkingHours(
    doctorId: string,
    dayOfWeek: DayOfWeek,
    data: Prisma.DoctorWorkingHoursUpdateInput,
  ): Promise<DoctorWorkingHours> {
    return this.prisma.doctorWorkingHours.update({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
      data,
    });
  }

  async deleteDoctorWorkingHours(
    doctorId: string,
    dayOfWeek: DayOfWeek,
  ): Promise<DoctorWorkingHours> {
    return this.prisma.doctorWorkingHours.delete({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
    });
  }

  async bulkUpdateDoctorWorkingHoursTransaction(
    doctorId: string,
    items: {
      enabled: boolean;
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
    }[],
  ): Promise<DoctorWorkingHours[]> {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.enabled) {
          await tx.doctorWorkingHours.deleteMany({
            where: { doctorId, dayOfWeek: item.dayOfWeek },
          });
          continue;
        }
        await tx.doctorWorkingHours.upsert({
          where: {
            doctorId_dayOfWeek: { doctorId, dayOfWeek: item.dayOfWeek },
          },
          update: { startTime: item.startTime, endTime: item.endTime },
          create: {
            doctorId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
          },
        });
      }
      return tx.doctorWorkingHours.findMany({
        where: { doctorId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  async createDoctorBreakTime(
    data: Prisma.DoctorBreakTimeCreateArgs,
  ): Promise<DoctorBreakTime> {
    return this.prisma.doctorBreakTime.create(data);
  }

  async findDoctorBreakTimes(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DoctorBreakTime[]> {
    const where: Prisma.DoctorBreakTimeWhereInput = { doctorId };
    if (startDate && endDate) {
      where.breakDate = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.breakDate = { gte: startDate };
    }
    return this.prisma.doctorBreakTime.findMany({
      where,
      orderBy: [{ breakDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async deleteDoctorBreakTime(id: string): Promise<DoctorBreakTime> {
    return this.prisma.doctorBreakTime.delete({ where: { id } });
  }

  async createDoctorOffDayTransaction(
    data: Prisma.DoctorOffDayCreateInput,
    cancelAffected: boolean,
    affectedBookingIds: string[],
  ): Promise<DoctorOffDay> {
    return this.prisma.$transaction(async (tx) => {
      const offDay = await tx.doctorOffDay.create({ data });
      if (cancelAffected && affectedBookingIds.length > 0) {
        await tx.booking.updateMany({
          where: { id: { in: affectedBookingIds } },
          data: { status: BookingStatus.CANCELLED },
        });
      }
      return offDay;
    });
  }

  async findDoctorOffDays(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DoctorOffDay[]> {
    const where: Prisma.DoctorOffDayWhereInput = { doctorId };
    if (startDate && endDate) {
      where.offDate = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.offDate = { gte: startDate };
    }
    return this.prisma.doctorOffDay.findMany({
      where,
      orderBy: { offDate: 'asc' },
    });
  }

  async findDoctorOffDay(
    doctorId: string,
    date: Date,
  ): Promise<DoctorOffDay | null> {
    return this.prisma.doctorOffDay.findUnique({
      where: { doctorId_offDate: { doctorId, offDate: date } },
    });
  }

  async deleteDoctorOffDay(
    doctorId: string,
    date: Date,
  ): Promise<DoctorOffDay> {
    return this.prisma.doctorOffDay.delete({
      where: { doctorId_offDate: { doctorId, offDate: date } },
    });
  }

  async findDoctorScheduleSlot(
    doctorId: string,
    date: Date,
  ): Promise<DoctorScheduleSlot | null> {
    return this.prisma.doctorScheduleSlot.findFirst({
      where: { doctorId, date, isActive: true },
    });
  }

  async countDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotCountArgs,
  ): Promise<number> {
    return this.prisma.doctorScheduleSlot.count(args);
  }
  async findManyDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotFindManyArgs,
  ): Promise<
    Prisma.DoctorScheduleSlotGetPayload<Prisma.DoctorScheduleSlotFindManyArgs>[]
  > {
    return this.prisma.doctorScheduleSlot.findMany(args);
  }
  async findUniqueDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotFindUniqueArgs,
  ): Promise<Prisma.DoctorScheduleSlotGetPayload<Prisma.DoctorScheduleSlotFindUniqueArgs> | null> {
    return this.prisma.doctorScheduleSlot.findUnique(args);
  }
  async createDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotCreateArgs,
  ): Promise<DoctorScheduleSlot> {
    return this.prisma.doctorScheduleSlot.create(args);
  }
  async updateDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotUpdateArgs,
  ): Promise<DoctorScheduleSlot> {
    return this.prisma.doctorScheduleSlot.update(args);
  }

  // === Bookings ===
  async createPreBookingTransaction(
    data: Prisma.BookingCreateInput,
    changedById: string,
  ): Promise<Prisma.BookingGetPayload<{ include: { statusHistory: true } }>> {
    return this.prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data,
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.PENDING,
          changedById,
          reason: 'Pre-booking created online',
        },
      });

      return newBooking as unknown as Prisma.BookingGetPayload<{
        include: { statusHistory: true };
      }>;
    });
  }

  async createWalkInBookingTransaction(
    data: Prisma.BookingCreateInput & { isPreBooked?: boolean },
    changedById: string,
  ): Promise<
    Prisma.BookingGetPayload<{
      include: { statusHistory: true; queueRecord: true };
    }>
  > {
    return this.prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data,
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.CONFIRMED,
          changedById,
          reason: data.isPreBooked
            ? 'Pre-booking created by receptionist'
            : 'Walk-in booking created by receptionist',
        },
      });

      return newBooking as unknown as Prisma.BookingGetPayload<{
        include: { statusHistory: true; queueRecord: true };
      }>;
    });
  }

  async countDailyWalkInBookings(
    doctorId: string,
    date: Date,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        doctorId,
        bookingDate: date,
        isPreBooked: false,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
      },
    });
  }

  async countConfirmedBookingsForSlot(
    doctorId: string,
    date: Date,
    timeSlot: string,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        doctorId,
        bookingDate: date,
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
  }

  async findBookingsWithFilters(
    filters: Prisma.BookingWhereInput,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<[Prisma.BookingGetPayload<Prisma.BookingFindManyArgs>[], number]> {
    const where: Prisma.BookingWhereInput = { ...filters };
    if (search) {
      where.OR = [
        { bookingCode: { contains: search } },
        {
          patientProfile: {
            fullName: { contains: search },
          },
        },
        {
          patientProfile: {
            patientCode: { contains: search },
          },
        },
        {
          patientProfile: { phone: { contains: search } },
        },
      ];
    }

    return Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          ...bookingInclude,
          queueRecord: true,
          medicalRecord: {
            include: {
              prescription: { include: { items: true } },
              labOrders: true,
            },
          },
        } as never,
        skip,
        take,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.prisma.booking.count({ where }),
    ]);
  }

  async findBookingById(id: string): Promise<BookingDetail | null> {
    return this.prisma.booking.findUnique({
      where: { id },
      include: {
        ...bookingInclude,
        queueRecord: true,
        statusHistory: {
          include: {
            changedBy: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        medicalRecord: {
          include: {
            prescription: { include: { items: true } },
            labOrders: true,
          },
        },
      },
    });
  }

  async findActiveExamination(doctorId: string): Promise<Booking | null> {
    return this.prisma.booking.findFirst({
      where: {
        doctorId,
        status: BookingStatus.IN_PROGRESS,
        medicalRecord: null,
      },
    });
  }

  async findBookingsByPatient(
    patientId: string,
  ): Promise<BookingWithDuration[]> {
    return this.prisma.booking.findMany({
      where: { patientProfileId: patientId },
      include: { service: { select: { durationMinutes: true } } },
    });
  }

  async findBookingsByDoctorAndDate(
    doctorId: string,
    date: Date,
  ): Promise<BookingWithDuration[]> {
    return this.prisma.booking.findMany({
      where: {
        doctorId,
        bookingDate: date,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
          ],
        },
      },
      include: { service: { select: { durationMinutes: true } } },
    });
  }

  async findAffectedBookingsForDateRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BookingWithRelations[]> {
    return this.prisma.booking.findMany({
      where: {
        doctorId,
        bookingDate: { gte: startDate, lte: endDate },
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ],
        },
      },
      include: bookingInclude,
      orderBy: { startTime: 'asc' },
    });
  }

  async updateBookingStatusTransaction(
    id: string,
    status: BookingStatus,
    reason: string,
    changedById: string,
    doctorNotes?: string,
    extraData?: Record<string, unknown>,
  ): Promise<Prisma.BookingGetPayload<{ include: { statusHistory: true } }>> {
    return this.prisma.$transaction(async (tx) => {
      const oldBooking = await tx.booking.findUnique({ where: { id } });
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status,
          doctorNotes: doctorNotes || undefined,
          ...extraData,
        },
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          oldStatus: oldBooking ? oldBooking.status : null,
          newStatus: status,
          changedById,
          reason,
        },
      });

      if (status === BookingStatus.COMPLETED) {
        await tx.invoice.updateMany({
          where: {
            bookingId: id,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.OPEN] },
          },
          data: { status: InvoiceStatus.ISSUED },
        });
      } else if (
        status === BookingStatus.CANCELLED ||
        status === BookingStatus.NO_SHOW
      ) {
        await tx.invoice.updateMany({
          where: {
            bookingId: id,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.OPEN] },
          },
          data: { status: InvoiceStatus.CANCELLED },
        });
      }

      return updated as unknown as Prisma.BookingGetPayload<{
        include: { statusHistory: true };
      }>;
    });
  }

  async countBookingsByFilters(
    where: Prisma.BookingWhereInput,
  ): Promise<number> {
    return this.prisma.booking.count({ where });
  }

  async findMostRecentBookingCode(prefix: string): Promise<Booking | null> {
    return this.prisma.booking.findFirst({
      where: { bookingCode: { startsWith: prefix } },
      orderBy: { bookingCode: 'desc' },
    });
  }

  async findDistinctPatientProfileIds(
    where: Prisma.BookingWhereInput,
    skip?: number,
    take?: number,
  ): Promise<{ patientProfileId: string }[]> {
    return this.prisma.booking.findMany({
      where,
      select: { patientProfileId: true },
      distinct: ['patientProfileId'],
      skip,
      take,
      orderBy: { bookingDate: 'desc' },
    });
  }

  async updateBookingEstimatedTime(
    id: string,
    estimatedTime: Date,
  ): Promise<void> {
    await this.prisma.booking.update({
      where: { id },
      data: { estimatedTime },
    });
  }

  async checkInTransaction(
    bookingId: string,
    doctorId: string,
    bookingDate: Date,
    isPreBooked: boolean,
    startTime: string | null,
    userId: string,
    estWaitMinutes: number,
    currentPosition: number,
  ): Promise<{ booking: Booking; queue: BookingQueue }> {
    return this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: BookingStatus.CONFIRMED,
          newStatus: BookingStatus.CHECKED_IN,
          changedById: userId,
          reason: 'Patient checked in at reception',
        },
      });

      const queueRecord = await tx.bookingQueue.create({
        data: {
          bookingId,
          doctorId,
          queueDate: bookingDate,
          queuePosition: currentPosition,
          estimatedWaitMinutes: estWaitMinutes,
          isPreBooked,
          scheduledTime: startTime,
        },
      });
      return { booking: updatedBooking, queue: queueRecord };
    });
  }

  // === Queues ===
  async findQueuesWithFilters(
    filters: Prisma.BookingQueueWhereInput,
    skip: number,
    take: number,
  ): Promise<[QueueRecordWithRelations[], number]> {
    return Promise.all([
      this.prisma.bookingQueue.findMany({
        where: filters,
        include: {
          booking: {
            include: {
              patientProfile: true,
              doctor: true,
              service: true,
              medicalRecord: true,
            },
          },
        } as never,
        orderBy: [
          { booking: { bookingDate: 'asc' } },
          { queuePosition: 'asc' },
        ],
        skip,
        take,
      }) as unknown as Promise<QueueRecordWithRelations[]>,
      this.prisma.bookingQueue.count({ where: filters }),
    ]);
  }

  async findQueueByBookingId(
    bookingId: string,
  ): Promise<QueueRecordWithRelations | null> {
    return this.prisma.bookingQueue.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            patientProfile: true,
            doctor: true,
            service: true,
          },
        },
      } as never,
    }) as unknown as Promise<QueueRecordWithRelations | null>;
  }

  async getQueueStatistics(
    doctorId?: string,
    date?: Date,
  ): Promise<{
    totalQueued: number;
    avgWaitTime: number | null;
    longestQueue: number | null;
  }> {
    const bookingWhere: Prisma.BookingWhereInput = {
      status: { in: [BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS] },
    };
    if (doctorId) bookingWhere.doctorId = doctorId;
    if (date) bookingWhere.bookingDate = date;

    const where: Prisma.BookingQueueWhereInput = { booking: bookingWhere };

    const [totalQueued, avgWaitTime, longestQueue] = await Promise.all([
      this.prisma.bookingQueue.count({ where }),
      this.prisma.bookingQueue.aggregate({
        where,
        _avg: { estimatedWaitMinutes: true },
      }),
      this.prisma.bookingQueue.findFirst({
        where,
        orderBy: { queuePosition: 'desc' },
        select: { queuePosition: true },
      }),
    ]);

    return {
      totalQueued,
      avgWaitTime: avgWaitTime._avg.estimatedWaitMinutes,
      longestQueue: longestQueue?.queuePosition ?? null,
    };
  }

  async promoteQueueTransaction(
    bookingId: string,
    promotedBy: string,
    reason: string,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const queueRecord = await tx.bookingQueue.findUnique({
        where: { bookingId },
        include: { booking: { include: bookingInclude } },
      });

      if (!queueRecord) return null;

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED },
        select: {
          ...bookingInclude,
          id: true,
          bookingCode: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          isPreBooked: true,
          status: true,
          doctorId: true,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: BookingStatus.CHECKED_IN,
          newStatus: BookingStatus.CONFIRMED,
          changedById: promotedBy,
          reason,
        },
      });

      await tx.bookingQueue.delete({ where: { bookingId } });

      const affectedQueues = await tx.bookingQueue.findMany({
        where: {
          booking: {
            doctorId: queueRecord.booking.doctorId,
            bookingDate: queueRecord.booking.bookingDate,
            startTime: queueRecord.booking.startTime,
            status: BookingStatus.CHECKED_IN,
          },
          queuePosition: { gt: queueRecord.queuePosition },
        },
      });

      for (const queue of affectedQueues) {
        await tx.bookingQueue.update({
          where: { id: queue.id },
          data: {
            queuePosition: queue.queuePosition - 1,
            estimatedWaitMinutes: queue.estimatedWaitMinutes - 30,
          },
        });
      }

      return updatedBooking;
    });
  }

  async findFirstInQueue(
    doctorId: string,
    bookingDate: Date,
    timeSlot: string,
  ): Promise<any> {
    return this.prisma.bookingQueue.findFirst({
      where: {
        booking: {
          doctorId,
          bookingDate,
          startTime: timeSlot,
          status: BookingStatus.CHECKED_IN,
        },
      },
      orderBy: { queuePosition: 'asc' },
      include: { booking: { include: { service: true } } },
    });
  }

  async findWalkInQueuesByDoctorAndDate(
    doctorId: string,
    date: Date,
  ): Promise<any[]> {
    return this.prisma.bookingQueue.findMany({
      where: {
        doctorId,
        queueDate: date,
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
          select: { id: true, service: { select: { durationMinutes: true } } },
        },
      },
      orderBy: { queuePosition: 'asc' },
    });
  }

  async removeFromQueueAndShiftTransaction(bookingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const queueRecord = await tx.bookingQueue.findUnique({
        where: { bookingId },
        include: { booking: true },
      });
      if (!queueRecord) return;

      await tx.bookingQueue.delete({ where: { bookingId } });

      const affectedQueues = await tx.bookingQueue.findMany({
        where: {
          booking: {
            doctorId: queueRecord.booking.doctorId,
            bookingDate: queueRecord.booking.bookingDate,
            startTime: queueRecord.booking.startTime,
            status: BookingStatus.CHECKED_IN,
          },
          queuePosition: { gt: queueRecord.queuePosition },
        },
      });

      for (const queue of affectedQueues) {
        await tx.bookingQueue.update({
          where: { id: queue.id },
          data: {
            queuePosition: queue.queuePosition - 1,
            estimatedWaitMinutes: queue.estimatedWaitMinutes - 30,
          },
        });
      }
    });
  }

  // Generic CRUD implementations
  count(args: Prisma.BookingCountArgs): Promise<number> {
    return this.prisma.booking.count(args);
  }
  findFirst<T extends Prisma.BookingFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindFirstArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null> {
    return this.prisma.booking.findFirst(
      args,
    ) as Promise<Prisma.BookingGetPayload<T> | null>;
  }
  findMany<T extends Prisma.BookingFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindManyArgs>,
  ): Promise<Prisma.BookingGetPayload<T>[]> {
    return this.prisma.booking.findMany(args) as Promise<
      Prisma.BookingGetPayload<T>[]
    >;
  }
  findUnique<T extends Prisma.BookingFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindUniqueArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null> {
    return this.prisma.booking.findUnique(
      args,
    ) as Promise<Prisma.BookingGetPayload<T> | null>;
  }
  update(args: Prisma.BookingUpdateArgs): Promise<Booking> {
    return this.prisma.booking.update(args);
  }
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
  countQueue(args: Prisma.BookingQueueCountArgs): Promise<number> {
    return this.prisma.bookingQueue.count(args);
  }
  findQueueMany<T extends Prisma.BookingQueueFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingQueueFindManyArgs>,
  ): Promise<Prisma.BookingQueueGetPayload<T>[]> {
    return this.prisma.bookingQueue.findMany(args) as Promise<
      Prisma.BookingQueueGetPayload<T>[]
    >;
  }
  findQueueFirst<T extends Prisma.BookingQueueFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingQueueFindFirstArgs>,
  ): Promise<Prisma.BookingQueueGetPayload<T> | null> {
    return this.prisma.bookingQueue.findFirst(
      args,
    ) as Promise<Prisma.BookingQueueGetPayload<T> | null>;
  }
  findQueueUnique<T extends Prisma.BookingQueueFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingQueueFindUniqueArgs>,
  ): Promise<Prisma.BookingQueueGetPayload<T> | null> {
    return this.prisma.bookingQueue.findUnique(
      args,
    ) as Promise<Prisma.BookingQueueGetPayload<T> | null>;
  }
  aggregateQueue(
    args: Prisma.BookingQueueAggregateArgs,
  ): Promise<
    Prisma.GetBookingQueueAggregateType<Prisma.BookingQueueAggregateArgs>
  > {
    return this.prisma.bookingQueue.aggregate(args);
  }
  updateQueue(args: Prisma.BookingQueueUpdateArgs): Promise<BookingQueue> {
    return this.prisma.bookingQueue.update(args);
  }
  deleteQueue(args: Prisma.BookingQueueDeleteArgs): Promise<BookingQueue> {
    return this.prisma.bookingQueue.delete(args);
  }
}
