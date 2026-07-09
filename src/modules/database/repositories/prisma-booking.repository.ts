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
  BookingSource,
  VisitStep,
  ScheduleSlotStatus,
  OffDayStatus,
} from '@prisma/client';

import { TransactionClient } from '../interfaces/clinical.repository.interface';
import {
  BookingDetail,
  BookingWithDuration,
  BookingWithRelations,
  QueueRecordWithRelations,
  BookingInclude,
  SlotReservation,
  ConfirmedBookingReminder,
  PendingOffDayWithDoctor,
  BookingForQueue,
  QueueRecordDetail,
  ActiveWalkInQueueForRecalculation,
  FirstInQueueDetail,
} from '../types/prisma-payload.types';
import {
  CreateOnlinePreBookingInput,
  CreateReceptionistBookingInput,
  CreateDirectServiceBookingInput,
  AssignServiceAndMoveToConfirmedInput,
} from '../types/repository-input.types';
import { IBookingRepository } from '../interfaces/booking.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from 'src/common/exceptions/api.exception';
import { MessageCodes } from 'src/common/constants/message-codes.const';

const bookingInclude = BookingInclude;

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

  async countBookingsByDateRange(gte?: Date, lte?: Date): Promise<number> {
    return this.prisma.booking.count({
      where: {
        ...(gte || lte
          ? {
              createdAt: {
                ...(gte ? { gte } : {}),
                ...(lte ? { lte } : {}),
              },
            }
          : {}),
      },
    });
  }

  async countCheckInsForDateRange(gte: Date, lte?: Date): Promise<number> {
    return this.prisma.booking.count({
      where: {
        status: {
          in: [
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
            BookingStatus.COMPLETED,
          ],
        },
        checkedInAt: {
          gte,
          ...(lte ? { lte } : {}),
        },
      },
    });
  }

  async countBookingsByStatusAndDateRange(
    status: string | string[],
    gte?: Date,
    lte?: Date,
    dateField: 'createdAt' | 'bookingDate' | 'checkedInAt' = 'createdAt',
  ): Promise<number> {
    const statuses = Array.isArray(status)
      ? (status as BookingStatus[])
      : [status as BookingStatus];
    const dateQuery =
      gte || lte
        ? {
            gte,
            ...(lte ? { lte } : {}),
          }
        : undefined;

    return this.prisma.booking.count({
      where: {
        status: { in: statuses },
        ...(dateQuery ? { [dateField]: dateQuery } : {}),
      },
    });
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
      breakStartTime?: string | null;
      breakEndTime?: string | null;
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
          update: {
            startTime: item.startTime,
            endTime: item.endTime,
            breakStartTime: item.breakStartTime ?? null,
            breakEndTime: item.breakEndTime ?? null,
          },
          create: {
            doctorId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
            breakStartTime: item.breakStartTime ?? null,
            breakEndTime: item.breakEndTime ?? null,
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

  async findDoctorOffDayById(id: string): Promise<DoctorOffDay | null> {
    return this.prisma.doctorOffDay.findUnique({
      where: { id },
    });
  }

  async findOffDaysWithDoctor(where: Prisma.DoctorOffDayWhereInput): Promise<
    (DoctorOffDay & {
      doctor: { id: string; fullName: string; email: string };
    })[]
  > {
    return this.prisma.doctorOffDay.findMany({
      where,
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { offDate: 'asc' },
    });
  }

  async updateDoctorOffDay(
    id: string,
    data: Prisma.DoctorOffDayUpdateInput,
  ): Promise<DoctorOffDay> {
    return this.prisma.doctorOffDay.update({
      where: { id },
      data,
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

  async countActiveScheduleSlotsForRoom(
    roomId: string,
    dateGte: Date,
  ): Promise<number> {
    return this.prisma.doctorScheduleSlot.count({
      where: {
        roomId,
        date: { gte: dateGte },
        isActive: true,
      },
    });
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

  async countActiveBookingsForDoctorInSlot(
    doctorId: string,
    date: Date,
    startTime: string,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        doctorId,
        bookingDate: date,
        startTime,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
            BookingStatus.AWAITING_RESULTS,
          ],
        },
      },
    });
  }

  async findConfirmedBookingsInTimeRange(
    startTime: Date,
    endTime: Date,
  ): Promise<ConfirmedBookingReminder[]> {
    return this.prisma.booking.findMany({
      where: {
        bookingDate: { gte: startTime, lte: endTime },
        isPreBooked: true,
        startTime: { not: null },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
      },
      include: {
        patientProfile: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            user: { select: { email: true } },
          },
        },
        doctor: true,
        service: true,
      },
    });
  }

  async findPendingOffDaysWithDoctor(): Promise<PendingOffDayWithDoctor[]> {
    return this.prisma.doctorOffDay.findMany({
      where: { status: OffDayStatus.PENDING },
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { offDate: 'asc' },
    });
  }

  // === Slot Reservations ===
  async createSlotReservation(
    data: Omit<SlotReservation, 'id' | 'createdAt'>,
  ): Promise<SlotReservation> {
    const prisma = this.prisma as PrismaService & {
      slotReservation: {
        create: (args: {
          data: Omit<SlotReservation, 'id' | 'createdAt'>;
        }) => Promise<SlotReservation>;
      };
    };
    return await prisma.slotReservation.create({ data });
  }

  async findSlotReservation(
    doctorId: string,
    date: Date,
    startTime: string,
  ): Promise<SlotReservation | null> {
    const prisma = this.prisma as PrismaService & {
      slotReservation: {
        findFirst: (args: { where: any }) => Promise<SlotReservation | null>;
      };
    };
    return await prisma.slotReservation.findFirst({
      where: {
        doctorId,
        bookingDate: date,
        startTime,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findSlotReservations(
    doctorId: string,
    date: Date,
  ): Promise<SlotReservation[]> {
    const prisma = this.prisma as PrismaService & {
      slotReservation: {
        findMany: (args: { where: any }) => Promise<SlotReservation[]>;
      };
    };
    return await prisma.slotReservation.findMany({
      where: { doctorId, bookingDate: date, expiresAt: { gt: new Date() } },
    });
  }

  async deleteSlotReservation(id: string): Promise<SlotReservation> {
    const prisma = this.prisma as PrismaService & {
      slotReservation: {
        delete: (args: { where: { id: string } }) => Promise<SlotReservation>;
      };
    };
    return await prisma.slotReservation.delete({ where: { id } });
  }

  async deleteExpiredReservations(): Promise<Prisma.BatchPayload> {
    const prisma = this.prisma as PrismaService & {
      slotReservation: {
        deleteMany: (args: { where: any }) => Promise<Prisma.BatchPayload>;
      };
    };
    return await prisma.slotReservation.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }

  async deleteSlotReservationByDetails(
    doctorId: string,
    date: Date,
    startTime: string,
    patientProfileId: string,
  ): Promise<Prisma.BatchPayload> {
    const prisma = this.prisma as PrismaService & {
      slotReservation: {
        deleteMany: (args: { where: any }) => Promise<Prisma.BatchPayload>;
      };
    };
    return await prisma.slotReservation.deleteMany({
      where: { doctorId, bookingDate: date, startTime, patientProfileId },
    });
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

  async createOnlinePreBookingTransaction(
    input: CreateOnlinePreBookingInput,
  ): Promise<BookingWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const confirmedBookings = await tx.booking.count({
        where: {
          doctorId: input.doctorId,
          bookingDate: input.bookingDate,
          startTime: input.startTime,
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
              BookingStatus.IN_PROGRESS,
              BookingStatus.AWAITING_RESULTS,
            ],
          },
        },
      });

      if (confirmedBookings >= input.maxSlotsPerHour) {
        throw new ApiException(
          MessageCodes.BOOKING_INVALID_TIME,
          'Time slot is no longer available (Race condition prevented)',
          409,
        );
      }

      const newBooking = await tx.booking.create({
        data: {
          patientProfileId: input.patientProfileId,
          doctorId: input.doctorId,
          serviceId: input.serviceId || undefined,
          bookingCode: input.bookingCode,
          bookingDate: input.bookingDate,
          startTime: input.startTime,
          endTime: input.endTime,
          isPreBooked: true,
          status: BookingStatus.PENDING,
          source: input.source,
          priority: input.priority,
          patientNotes: input.patientNotes,
          bookedBy: null,
          bookingMode: 'CONSULTATION_FIRST',
        },
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.PENDING,
          changedById: input.createdById || null,
          reason: 'Pre-booking created online',
        },
      });

      if (input.source === BookingSource.ONLINE) {
        await (
          tx as TransactionClient & {
            slotReservation: {
              deleteMany: (args: {
                where: {
                  doctorId: string;
                  bookingDate: Date;
                  startTime: string;
                  patientProfileId: string;
                };
              }) => Promise<Prisma.BatchPayload>;
            };
          }
        ).slotReservation.deleteMany({
          where: {
            doctorId: input.doctorId,
            bookingDate: input.bookingDate,
            startTime: input.startTime,
            patientProfileId: input.patientProfileId,
          },
        });
      }

      return newBooking as unknown as BookingWithRelations;
    });
  }

  async createReceptionistBookingTransaction(
    input: CreateReceptionistBookingInput,
  ): Promise<BookingWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isPreBooked && input.startTime) {
        const confirmedBookings = await tx.booking.count({
          where: {
            doctorId: input.doctorId,
            bookingDate: input.bookingDate,
            startTime: input.startTime,
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN,
                BookingStatus.IN_PROGRESS,
                BookingStatus.AWAITING_RESULTS,
              ],
            },
          },
        });

        if (confirmedBookings >= input.maxSlotsPerHour) {
          throw new ApiException(
            MessageCodes.BOOKING_INVALID_TIME,
            'Time slot is no longer available (Race condition prevented)',
            409,
          );
        }
      }

      const newBooking = await tx.booking.create({
        data: {
          patientProfileId: input.patientProfileId,
          doctorId: input.doctorId,
          serviceId: input.serviceId || undefined,
          bookingCode: input.bookingCode,
          bookingDate: input.bookingDate,
          startTime: input.isPreBooked ? input.startTime : undefined,
          endTime: input.isPreBooked ? input.endTime : undefined,
          isPreBooked: input.isPreBooked,
          status: input.isPreBooked
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
          source: input.source,
          priority: input.priority,
          patientNotes: input.patientNotes,
          bookedBy: input.createdById,
          confirmedAt: input.isPreBooked ? null : new Date(),
          roomId: input.roomId || undefined,
          bookingMode: 'CONSULTATION_FIRST',
        },
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: input.isPreBooked
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
          changedById: input.createdById,
          reason: input.isPreBooked
            ? 'Pre-booking created by receptionist, pending confirmation'
            : 'Walk-in booking created by receptionist, auto-confirmed',
        },
      });

      return newBooking as unknown as BookingWithRelations;
    });
  }

  async createDirectServiceBookingTransaction(
    input: CreateDirectServiceBookingInput,
  ): Promise<BookingWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isPreBooked && input.startTime) {
        const confirmedBookings = await tx.booking.count({
          where: {
            doctorId: input.doctorId,
            bookingDate: input.bookingDate,
            startTime: input.startTime,
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN,
                BookingStatus.IN_PROGRESS,
                BookingStatus.AWAITING_RESULTS,
              ],
            },
          },
        });

        if (confirmedBookings >= input.maxSlotsPerHour) {
          throw new ApiException(
            MessageCodes.BOOKING_INVALID_TIME,
            'Time slot is no longer available (Race condition prevented)',
            409,
          );
        }
      }

      const primaryService = input.services[0];

      const newBooking = await tx.booking.create({
        data: {
          patientProfileId: input.patientProfileId,
          doctorId: input.doctorId,
          serviceId: primaryService.id,
          bookingCode: input.bookingCode,
          bookingDate: input.bookingDate,
          startTime: input.isPreBooked ? input.startTime : undefined,
          endTime: input.isPreBooked ? input.endTime : undefined,
          isPreBooked: input.isPreBooked,
          status: BookingStatus.CONFIRMED,
          source: BookingSource.WALK_IN,
          priority: input.priority,
          patientNotes: input.patientNotes,
          bookedBy: input.createdById,
          confirmedAt: new Date(),
          roomId: input.roomId ?? undefined,
          bookingMode: 'DIRECT_SERVICE',
        },
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          oldStatus: null,
          newStatus: BookingStatus.CONFIRMED,
          changedById: input.createdById,
          reason:
            'Mode B — Direct service walk-in: patient knows what service they need',
        },
      });

      const medicalRecord = await tx.medicalRecord.create({
        data: {
          bookingId: newBooking.id,
          patientProfileId: input.patientProfileId,
          doctorId: input.doctorId,
          visitStep: VisitStep.SERVICES_ORDERED,
          orderedAt: new Date(),
          version: 1,
        },
      });

      const labOrdersToInvoice: Array<{
        service: (typeof input.services)[0];
        orderId: string;
      }> = [];
      const visitOrdersToInvoice: Array<{
        service: (typeof input.services)[0];
        orderId: string;
      }> = [];

      for (const svc of input.services) {
        if (svc.performerType === 'TECHNICIAN') {
          const labOrder = await tx.labOrder.create({
            data: {
              medicalRecordId: medicalRecord.id,
              serviceId: svc.id,
              patientProfileId: input.patientProfileId,
              bookingId: newBooking.id,
              doctorId: input.doctorId,
              testName: svc.name,
              status: 'PENDING',
            },
          });
          labOrdersToInvoice.push({ service: svc, orderId: labOrder.id });
        } else {
          const explicitAssignment = input.serviceAssignments?.find(
            (a) => a.serviceId === svc.id,
          );
          const performingUserId =
            explicitAssignment?.performingDoctorId ?? null;

          const visitOrder = await tx.visitServiceOrder.create({
            data: {
              medicalRecordId: medicalRecord.id,
              serviceId: svc.id,
              patientProfileId: input.patientProfileId,
              bookingId: newBooking.id,
              orderedBy: input.doctorId,
              performedBy: performingUserId,
              status: 'PENDING',
            },
          });
          visitOrdersToInvoice.push({ service: svc, orderId: visitOrder.id });
        }
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `INV-${dateStr}-`;

      const generateSequence = async (key: string): Promise<number> => {
        const result = await tx.sequenceCounter.upsert({
          where: { key },
          create: { key, value: 1 },
          update: { value: { increment: 1 } },
        });
        return result.value;
      };

      if (labOrdersToInvoice.length > 0) {
        const count = await generateSequence(prefix);
        const invoiceNumber = `${prefix}${String(count).padStart(4, '0')}`;
        const totalAmount = labOrdersToInvoice.reduce(
          (sum, item) => sum + Number(item.service.price),
          0,
        );

        await tx.invoice.create({
          data: {
            bookingId: newBooking.id,
            patientProfileId: input.patientProfileId,
            invoiceType: 'SERVICE',
            invoiceNumber,
            subtotal: totalAmount,
            discountAmount: 0,
            vatRate: 0,
            vatAmount: 0,
            taxAmount: 0,
            totalAmount,
            status: 'DRAFT',
            notes: 'Mode B — Thu tiền tại quầy lễ tân (Dịch vụ CLS).',
            items: {
              create: labOrdersToInvoice.map((item, idx) => ({
                itemName: item.service.name,
                unitPrice: Number(item.service.price),
                quantity: 1,
                totalPrice: Number(item.service.price),
                sortOrder: idx,
                labOrderId: item.orderId,
                serviceId: item.service.id,
              })),
            },
          },
        });
      }

      if (visitOrdersToInvoice.length > 0) {
        const count = await generateSequence(prefix);
        const invoiceNumber = `${prefix}${String(count).padStart(4, '0')}`;
        const totalAmount = visitOrdersToInvoice.reduce(
          (sum, item) => sum + Number(item.service.price),
          0,
        );

        await tx.invoice.create({
          data: {
            bookingId: newBooking.id,
            patientProfileId: input.patientProfileId,
            invoiceType: 'SERVICE',
            invoiceNumber,
            subtotal: totalAmount,
            discountAmount: 0,
            vatRate: 0,
            vatAmount: 0,
            taxAmount: 0,
            totalAmount,
            status: 'DRAFT',
            notes: 'Mode B — Thu tiền tại quầy lễ tân (Khám chuyên khoa).',
            items: {
              create: visitOrdersToInvoice.map((item, idx) => ({
                itemName: item.service.name,
                unitPrice: Number(item.service.price),
                quantity: 1,
                totalPrice: Number(item.service.price),
                sortOrder: idx,
                visitServiceOrderId: item.orderId,
                serviceId: item.service.id,
              })),
            },
          },
        });
      }

      return newBooking as unknown as BookingWithRelations;
    });
  }

  async assignServiceAndMoveToConfirmedTransaction(
    input: AssignServiceAndMoveToConfirmedInput,
  ): Promise<Booking> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          serviceId: input.serviceId,
          doctorId: input.doctorId,
          status: BookingStatus.CONFIRMED,
          checkedInAt: null,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.bookingId,
          oldStatus: input.oldStatus,
          newStatus: BookingStatus.CONFIRMED,
          changedById: input.changedById,
          reason:
            'Service assigned by consultation doctor. Moved to payment stage.',
        },
      });

      return updated;
    });
  }

  async updateBookingStatusTransaction(
    bookingId: string,
    status: BookingStatus,
    changedById: string,
    reason: string,
    doctorNotes?: string,
    extraData?: Prisma.BookingUpdateInput,
  ): Promise<BookingWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      });

      if (!booking) {
        throw new ApiException(
          MessageCodes.BOOKING_NOT_FOUND,
          'Booking not found',
          404,
          'Status update failed',
        );
      }

      const updateData: Prisma.BookingUpdateInput = {
        status,
        doctorNotes: doctorNotes || booking.doctorNotes,
      };

      if (status === BookingStatus.CONFIRMED) {
        updateData.confirmedAt = new Date();
      }
      if (status === BookingStatus.CHECKED_IN) {
        updateData.checkedInAt = new Date();
      }

      if (extraData) {
        Object.assign(updateData, extraData);
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: booking.status,
          newStatus: status,
          changedById,
          reason,
        },
      });

      if (
        status === BookingStatus.CANCELLED ||
        status === BookingStatus.COMPLETED ||
        status === BookingStatus.NO_SHOW
      ) {
        if (status === BookingStatus.COMPLETED) {
          await tx.invoice.updateMany({
            where: {
              bookingId,
              status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.OPEN] },
            },
            data: { status: InvoiceStatus.ISSUED },
          });
        } else {
          await tx.invoice.updateMany({
            where: {
              bookingId,
              status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.OPEN] },
            },
            data: { status: InvoiceStatus.CANCELLED },
          });
        }
      }

      if (status === BookingStatus.IN_PROGRESS) {
        const doctorUser = await tx.user.findUnique({
          where: { id: updated.doctorId },
          include: { doctorProfile: { select: { consultationFee: true } } },
        });
        const fee = Number(doctorUser?.doctorProfile?.consultationFee ?? 0);

        if (fee > 0) {
          const existingConsultation = await tx.invoice.findFirst({
            where: {
              bookingId,
              invoiceType: 'CONSULTATION',
              status: { notIn: ['CANCELLED'] },
            },
          });
          if (!existingConsultation) {
            const count = await tx.invoice.count();
            const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
            await tx.invoice.create({
              data: {
                bookingId,
                patientProfileId: updated.patientProfileId,
                invoiceType: 'CONSULTATION',
                invoiceNumber,
                subtotal: fee,
                discountAmount: 0,
                vatRate: 0,
                vatAmount: 0,
                taxAmount: 0,
                totalAmount: fee,
                status: 'DRAFT',
                notes: 'Phí tư vấn — thu tại bước B3 khi BN ra quầy lễ tân',
                items: {
                  create: {
                    itemName: 'Phí khám tư vấn',
                    unitPrice: fee,
                    quantity: 1,
                    totalPrice: fee,
                    sortOrder: 0,
                  },
                },
              },
            });
          }
        }
      }

      return updated as unknown as BookingWithRelations;
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

  async findBookingsPaginated(filterDto: {
    patientProfileId?: string;
    doctorId?: string;
    serviceId?: string;
    status?: BookingStatus;
    date?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<[BookingWithRelations[], number]> {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      status,
      date,
      search,
      page = 1,
      limit = 10,
    } = filterDto;

    const where: Prisma.BookingWhereInput = {};

    if (patientProfileId) where.patientProfileId = patientProfileId;
    if (doctorId) where.doctorId = doctorId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (date) where.bookingDate = new Date(date);

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

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.prisma.booking.count({ where }),
    ]);

    return [bookings as unknown as BookingWithRelations[], total];
  }

  async findPatientBookingsPaginated(
    patientProfileId: string,
    statusFilter: string | undefined,
    page: number,
    limit: number,
  ): Promise<[BookingWithRelations[], number]> {
    const where: Prisma.BookingWhereInput = {
      patientProfileId,
    };

    if (statusFilter) {
      if (statusFilter === 'upcoming') {
        where.status = {
          in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'QUEUED', 'IN_PROGRESS'],
        };
      } else if (statusFilter === 'completed') {
        where.status = 'COMPLETED';
      } else if (statusFilter === 'cancelled') {
        where.status = { in: ['CANCELLED', 'NO_SHOW'] };
      } else if (statusFilter !== 'all') {
        where.status = statusFilter as BookingStatus;
      }
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
              iconUrl: true,
            },
          },
          doctor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true,
            },
          },
          queueRecord: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      }),
      this.prisma.booking.count({ where }),
    ]);

    return [bookings as unknown as BookingWithRelations[], total];
  }

  async getPatientStatsAndNextBooking(
    patientProfileId: string,
    today: Date,
  ): Promise<{
    stats: {
      upcomingBookings: number;
      completedBookings: number;
      waitingBookings: number;
      totalBookings: number;
    };
    nextBooking: any;
  }> {
    const [
      upcomingBookings,
      completedBookings,
      waitingBookings,
      totalBookings,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          patientProfileId,
          status: BookingStatus.CONFIRMED,
          bookingDate: { gte: today },
        },
      }),
      this.prisma.booking.count({
        where: { patientProfileId, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { patientProfileId, status: BookingStatus.CHECKED_IN },
      }),
      this.prisma.booking.count({ where: { patientProfileId } }),
    ]);

    const nextBooking = await this.prisma.booking.findFirst({
      where: {
        patientProfileId,
        status: BookingStatus.CONFIRMED,
        bookingDate: { gte: today },
      },
      include: {
        service: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true, avatar: true } },
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });

    return {
      stats: {
        upcomingBookings,
        completedBookings,
        waitingBookings,
        totalBookings,
      },
      nextBooking,
    };
  }

  async findDoctorPatientsPaginated(
    doctorId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ patients: any[]; total: number }> {
    const patientWhere: Prisma.PatientProfileWhereInput = {};
    if (search) {
      patientWhere.OR = [
        { fullName: { contains: search } },
        { patientCode: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // Get distinct patientProfileIds that have at least one COMPLETED booking with this doctor
    const completedPatientIds = await this.prisma.booking.findMany({
      where: {
        doctorId,
        status: BookingStatus.COMPLETED,
        patientProfile: search ? patientWhere : undefined,
      },
      select: { patientProfileId: true },
      distinct: ['patientProfileId'],
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { bookingDate: 'desc' },
    });

    const totalDistinct = await this.prisma.booking.findMany({
      where: {
        doctorId,
        status: BookingStatus.COMPLETED,
        patientProfile: search ? patientWhere : undefined,
      },
      select: { patientProfileId: true },
      distinct: ['patientProfileId'],
    });

    const ids = completedPatientIds.map((b) => b.patientProfileId);

    const patients = await Promise.all(
      ids.map(async (patientProfileId) => {
        const profile = await this.prisma.patientProfile.findUnique({
          where: { id: patientProfileId },
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
            bloodType: true,
            allergies: true,
          },
        });

        const [totalVisits, lastVisitRecord] = await Promise.all([
          this.prisma.booking.count({
            where: {
              doctorId,
              patientProfileId,
              status: BookingStatus.COMPLETED,
            },
          }),
          this.prisma.booking.findFirst({
            where: {
              doctorId,
              patientProfileId,
              status: BookingStatus.COMPLETED,
            },
            orderBy: { bookingDate: 'desc' },
            select: { bookingDate: true, service: { select: { name: true } } },
          }),
        ]);

        return {
          ...profile,
          totalVisits,
          lastVisitDate: lastVisitRecord?.bookingDate ?? null,
          lastServiceName: lastVisitRecord?.service?.name ?? null,
        };
      }),
    );

    return {
      patients,
      total: totalDistinct.length,
    };
  }

  async getReceptionistStats(
    today: Date,
    tomorrow: Date,
  ): Promise<{
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }> {
    const stats = await this.prisma.booking.groupBy({
      by: ['status'],
      where: {
        bookingDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      _count: {
        _all: true,
      },
    });

    const result = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    stats.forEach((s) => {
      const statusKey = s.status.toLowerCase();
      if (statusKey in result) {
        result[statusKey as keyof typeof result] = s._count._all;
      }
    });

    return result;
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
          ...BookingInclude,
          queueRecord: true,
          medicalRecord: {
            include: {
              prescription: { include: { items: true } },
              labOrders: true,
            },
          },
        },
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
        ...BookingInclude,
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

  async findBookingWithRelations(
    id: string,
  ): Promise<BookingWithRelations | null> {
    return this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    }) as unknown as Promise<BookingWithRelations | null>;
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
      include: {
        service: { select: { durationMinutes: true, maxSlotsPerHour: true } },
      },
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
      include: {
        service: { select: { durationMinutes: true, maxSlotsPerHour: true } },
      },
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
      include: BookingInclude,
      orderBy: { startTime: 'asc' },
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
  ): Promise<{ booking: BookingWithRelations; queue: BookingQueue }> {
    return this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
        include: BookingInclude,
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

  async findBookingForQueue(
    bookingId: string,
  ): Promise<BookingForQueue | null> {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        patientProfile: true,
      },
    });
  }

  async findLatestQueuePosition(
    doctorId: string,
    queueDate: Date,
  ): Promise<number> {
    const latest = await this.prisma.bookingQueue.findFirst({
      where: {
        doctorId,
        queueDate,
      },
      orderBy: {
        queuePosition: 'desc',
      },
      select: {
        queuePosition: true,
      },
    });
    return latest ? latest.queuePosition : 0;
  }

  async countCheckedInQueue(
    doctorId: string,
    queueDate: Date,
  ): Promise<number> {
    return this.prisma.bookingQueue.count({
      where: {
        doctorId,
        queueDate,
        booking: { status: BookingStatus.CHECKED_IN },
      },
    });
  }

  async findQueueRecordsPaginated(
    doctorId?: string,
    date?: string,
    timeSlot?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<[QueueRecordDetail[], number]> {
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

    const skip = (page - 1) * limit;

    const [queueRecords, total] = await Promise.all([
      this.prisma.bookingQueue.findMany({
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
        skip,
        take: limit,
      }),
      this.prisma.bookingQueue.count({ where }),
    ]);

    return [queueRecords, total];
  }

  async findActivePreBookingsForRecalculation(
    doctorId: string,
    bookingDate: Date,
  ): Promise<{ startTime: string | null; endTime: string | null }[]> {
    return this.prisma.booking.findMany({
      where: {
        doctorId,
        bookingDate,
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
  }

  async findActiveWalkInQueueForRecalculation(
    doctorId: string,
    bookingDate: Date,
  ): Promise<ActiveWalkInQueueForRecalculation[]> {
    return this.prisma.bookingQueue.findMany({
      where: {
        doctorId,
        queueDate: bookingDate,
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
        include: { booking: { include: BookingInclude } },
      });

      if (!queueRecord) return null;

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED },
        select: {
          ...BookingInclude,
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
  ): Promise<FirstInQueueDetail | null> {
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
  ): Promise<ActiveWalkInQueueForRecalculation[]> {
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

  async findTreatmentRelationship(
    doctorId: string,
    patientProfileId: string,
  ): Promise<any> {
    return this.prisma.booking.findFirst({
      where: {
        doctorId,
        patientProfileId,
      },
    });
  }

  async findBookingForInvoiceCreation(bookingId: string): Promise<any> {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        patientProfile: { select: { id: true, fullName: true } },
      },
    });
  }

  async findBookingPatientProfileId(bookingId: string): Promise<any> {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, patientProfileId: true },
    });
  }

  async findWorkspaceQueueBookings(params: {
    todayStart: Date;
    tomorrowStart: Date;
    thirtyDaysAgo: Date;
    search?: string;
  }): Promise<
    Prisma.BookingGetPayload<{
      include: {
        patientProfile: true;
        doctor: { select: { fullName: true } };
        medicalRecord: true;
        invoices: {
          include: { items: true };
        };
      };
    }>[]
  > {
    const { todayStart, tomorrowStart, thirtyDaysAgo, search } = params;

    const dateFilter: Prisma.BookingWhereInput = {
      OR: [
        { bookingDate: { gte: todayStart, lt: tomorrowStart } },
        {
          bookingDate: { gte: thirtyDaysAgo, lt: todayStart },
          status: {
            notIn: [
              BookingStatus.CANCELLED,
              BookingStatus.NO_SHOW,
              BookingStatus.COMPLETED,
            ],
          },
        },
      ],
    };

    const searchFilter: Prisma.BookingWhereInput | undefined = search
      ? {
          OR: [
            { bookingCode: { contains: search } },
            {
              patientProfile: {
                OR: [
                  { fullName: { contains: search } },
                  { phone: { contains: search } },
                  { patientCode: { contains: search } },
                ],
              },
            },
          ],
        }
      : undefined;

    const where: Prisma.BookingWhereInput = {
      AND: [
        { status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] } },
        dateFilter,
        ...(searchFilter ? [searchFilter] : []),
      ],
    };

    return this.prisma.booking.findMany({
      where,
      include: {
        patientProfile: true,
        doctor: { select: { fullName: true } },
        medicalRecord: true,
        invoices: {
          include: { items: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findBookingsWithInvoicesInDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<
    Prisma.BookingGetPayload<{
      include: {
        invoices: true;
      };
    }>[]
  > {
    return this.prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: startDate,
          lt: endDate,
        },
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      },
      include: {
        invoices: true,
      },
    });
  }

  async findTechnicians(): Promise<
    Prisma.UserGetPayload<{
      select: { id: true };
    }>[]
  > {
    return this.prisma.user.findMany({
      where: { role: 'TECHNICIAN' },
      select: { id: true },
    });
  }

  async hasTreatmentRelationship(
    doctorId: string,
    patientProfileId: string,
  ): Promise<boolean> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        doctorId,
        patientProfileId,
        status: {
          in: [
            'CONFIRMED',
            'CHECKED_IN',
            'IN_PROGRESS',
            'AWAITING_RESULTS',
            'COMPLETED',
            'PENDING',
            'CANCELLED',
          ],
        },
      },
      select: { id: true },
    });
    return !!booking;
  }

  async countActiveBookingsForPatient(
    patientProfileId: string,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        patientProfileId,
        status: {
          in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
        },
      },
    });
  }

  async countActiveWalkInBookings(
    doctorId: string,
    bookingDate: Date,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        doctorId,
        bookingDate,
        isPreBooked: false,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      },
    });
  }

  async findActiveBookingForPatient(
    patientProfileId: string,
    doctorId: string,
    bookingDate: Date,
  ): Promise<Booking | null> {
    return this.prisma.booking.findFirst({
      where: {
        patientProfileId,
        doctorId,
        bookingDate,
        status: {
          notIn: [
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW,
            BookingStatus.COMPLETED,
          ],
        },
      },
    });
  }

  async findOverduePreBookings(
    bookingDate: Date,
    cutoffTimeStr: string,
  ): Promise<
    Prisma.BookingGetPayload<{
      select: {
        id: true;
        bookingCode: true;
        doctorId: true;
        bookingDate: true;
      };
    }>[]
  > {
    return this.prisma.booking.findMany({
      where: {
        isPreBooked: true,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
        bookingDate,
        startTime: {
          lte: cutoffTimeStr,
        },
        checkedInAt: null,
      },
      select: {
        id: true,
        bookingCode: true,
        doctorId: true,
        bookingDate: true,
      },
    });
  }

  async getDoctorBookingStats(
    doctorId: string,
    startOfToday: Date,
    endOfToday: Date,
  ): Promise<{
    patientsSeenToday: number;
    totalPatientsSeen: number;
    pendingActive: number;
  }> {
    const [patientsSeenToday, totalPatientsSeen, pendingActive] =
      await Promise.all([
        this.prisma.booking.count({
          where: {
            doctorId,
            bookingDate: {
              gte: startOfToday,
              lt: endOfToday,
            },
            status: 'COMPLETED',
          },
        }),
        this.prisma.booking.count({
          where: {
            doctorId,
            status: 'COMPLETED',
          },
        }),
        this.prisma.booking.count({
          where: {
            doctorId,
            status: {
              in: [
                'CONFIRMED',
                'CHECKED_IN',
                'IN_PROGRESS',
                'AWAITING_RESULTS',
              ],
            },
          },
        }),
      ]);

    return {
      patientsSeenToday,
      totalPatientsSeen,
      pendingActive,
    };
  }

  async findBookingForPostVisitEmail(
    bookingId: string,
  ): Promise<Prisma.BookingGetPayload<{
    include: {
      patientProfile: { include: { user: { select: { email: true } } } };
      doctor: true;
      service: true;
    };
  }> | null> {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        patientProfile: { include: { user: { select: { email: true } } } },
        doctor: true,
        service: true,
      },
    });
  }

  async findPatientLastAndNextBookings(
    patientProfileIds: string[],
    today: Date,
  ): Promise<
    [
      Prisma.BookingGetPayload<{
        select: {
          patientProfileId: true;
          bookingDate: true;
          doctor: { select: { fullName: true } };
        };
      }>[],
      Prisma.BookingGetPayload<{
        select: {
          patientProfileId: true;
          bookingDate: true;
          doctor: { select: { fullName: true } };
        };
      }>[],
    ]
  > {
    if (patientProfileIds.length === 0) {
      return [[], []];
    }

    const [lastVisitRecords, nextApptRecords] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          patientProfileId: { in: patientProfileIds },
          status: BookingStatus.COMPLETED,
        },
        orderBy: { bookingDate: 'desc' },
        distinct: ['patientProfileId'],
        select: {
          patientProfileId: true,
          bookingDate: true,
          doctor: { select: { fullName: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          patientProfileId: { in: patientProfileIds },
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
            ],
          },
          bookingDate: { gte: today },
        },
        orderBy: { bookingDate: 'asc' },
        distinct: ['patientProfileId'],
        select: {
          patientProfileId: true,
          bookingDate: true,
          doctor: { select: { fullName: true } },
        },
      }),
    ]);

    return [lastVisitRecords, nextApptRecords];
  }

  async getBookingDashboardStats(params: {
    startOfToday: Date;
    startOfTomorrow: Date;
    startOfSameLastWeek: Date;
    startOfDayAfterLastWeek: Date;
    startOfMonth: Date;
    startOfLastMonth: Date;
  }): Promise<{
    patientsTodayCount: number;
    patientsLastWeekDayCount: number;
    activeAppointments: number;
    activeAppointmentsLastMonth: number;
  }> {
    const {
      startOfToday,
      startOfTomorrow,
      startOfSameLastWeek,
      startOfDayAfterLastWeek,
      startOfMonth,
      startOfLastMonth,
    } = params;

    const notCancelledOrNoShow = {
      notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
    };

    const activeStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.CHECKED_IN,
      BookingStatus.IN_PROGRESS,
      BookingStatus.AWAITING_RESULTS,
    ];

    const [
      patientsToday,
      patientsLastWeekDay,
      activeAppointments,
      activeAppointmentsLastMonth,
    ] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          bookingDate: { gte: startOfToday, lt: startOfTomorrow },
          status: notCancelledOrNoShow,
        },
        distinct: ['patientProfileId'],
        select: { patientProfileId: true },
      }),
      this.prisma.booking.findMany({
        where: {
          bookingDate: {
            gte: startOfSameLastWeek,
            lt: startOfDayAfterLastWeek,
          },
          status: notCancelledOrNoShow,
        },
        distinct: ['patientProfileId'],
        select: { patientProfileId: true },
      }),
      this.prisma.booking.count({
        where: {
          bookingDate: { gte: startOfMonth },
          status: { in: activeStatuses },
        },
      }),
      this.prisma.booking.count({
        where: {
          bookingDate: { gte: startOfLastMonth, lt: startOfMonth },
          status: { in: activeStatuses },
        },
      }),
    ]);

    return {
      patientsTodayCount: patientsToday.length,
      patientsLastWeekDayCount: patientsLastWeekDay.length,
      activeAppointments,
      activeAppointmentsLastMonth,
    };
  }

  async getScheduleDashboardStats(
    today: Date,
    endOfToday: Date,
  ): Promise<{
    totalAppointments: number;
    todaysSlots: number;
    canceledToday: number;
    avgWaitTime: number;
  }> {
    const [totalAppointments, todaysSlots, canceledToday, queuedBookings] =
      await Promise.all([
        this.prisma.booking.count({}),
        this.prisma.doctorScheduleSlot.count({
          where: {
            date: {
              gte: today,
              lte: endOfToday,
            },
          },
        }),
        this.prisma.booking.count({
          where: {
            status: BookingStatus.CANCELLED,
            bookingDate: {
              gte: today,
              lte: endOfToday,
            },
          },
        }),
        this.prisma.bookingQueue.aggregate({
          _avg: {
            estimatedWaitMinutes: true,
          },
        }),
      ]);

    return {
      totalAppointments,
      todaysSlots,
      canceledToday,
      avgWaitTime: Math.round(queuedBookings._avg?.estimatedWaitMinutes ?? 0),
    };
  }

  async findAdminScheduleSlots(filters: {
    doctorId?: string;
    status?: string;
    isActive?: boolean;
    startDate?: string | Date;
    endDate?: string | Date;
  }): Promise<
    Prisma.DoctorScheduleSlotGetPayload<{
      include: {
        doctor: {
          select: {
            id: true;
            fullName: true;
            doctorProfile: {
              select: { specialties: true };
            };
          };
        };
        room: {
          select: { id: true; name: true };
        };
      };
    }>[]
  > {
    const where: Prisma.DoctorScheduleSlotWhereInput = {};

    if (filters.doctorId) {
      where.doctorId = filters.doctorId;
    }
    if (filters.status) {
      where.status = filters.status.toUpperCase() as ScheduleSlotStatus;
    } else if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    return this.prisma.doctorScheduleSlot.findMany({
      where,
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            doctorProfile: {
              select: { specialties: true },
            },
          },
        },
        room: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findAdminScheduleSlotDetail(
    id: string,
  ): Promise<Prisma.DoctorScheduleSlotGetPayload<{
    include: {
      doctor: {
        select: { fullName: true };
      };
      room: {
        select: { id: true; name: true };
      };
    };
  }> | null> {
    return this.prisma.doctorScheduleSlot.findUnique({
      where: { id },
      include: {
        doctor: {
          select: { fullName: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getMostBookedServiceId(): Promise<{
    serviceId: string;
    count: number;
  } | null> {
    const topBooking = await this.prisma.booking.groupBy({
      by: ['serviceId'],
      where: { status: BookingStatus.COMPLETED },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    if (topBooking.length > 0 && topBooking[0].serviceId) {
      return {
        serviceId: topBooking[0].serviceId,
        count: topBooking[0]._count?.id ?? 0,
      };
    }

    return null;
  }

  async getServiceBookingStats(serviceId: string): Promise<{
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
  }> {
    const [totalBookings, completedBookings, cancelledBookings] =
      await Promise.all([
        this.prisma.booking.count({ where: { serviceId } }),
        this.prisma.booking.count({
          where: { serviceId, status: BookingStatus.COMPLETED },
        }),
        this.prisma.booking.count({
          where: { serviceId, status: BookingStatus.CANCELLED },
        }),
      ]);

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
    };
  }

  findBookingsForTopDoctors(filter: {
    gte: Date;
    lte?: Date;
    bookingIds: string[];
  }): Promise<
    Array<{
      id: string;
      doctorId: string;
      doctor: {
        fullName: string;
        avatar: string | null;
        doctorProfile: { specialties: Prisma.JsonValue } | null;
      };
    }>
  > {
    return this.prisma.booking.findMany({
      where: { id: { in: filter.bookingIds } },
      select: {
        id: true,
        doctorId: true,
        doctor: {
          select: {
            fullName: true,
            avatar: true,
            doctorProfile: { select: { specialties: true } },
          },
        },
      },
    }) as unknown as Promise<
      Array<{
        id: string;
        doctorId: string;
        doctor: {
          fullName: string;
          avatar: string | null;
          doctorProfile: { specialties: Prisma.JsonValue } | null;
        };
      }>
    >;
  }

  findBookingsForDoctorAnalytics(filter: {
    doctorId: string;
    gte?: Date;
    lte?: Date;
    statuses?: string[];
    selectFields:
      | 'status_source'
      | 'status'
      | 'bookingDate'
      | 'patientProfileId';
  }): Promise<Partial<Booking>[]> {
    const where: Prisma.BookingWhereInput = { doctorId: filter.doctorId };

    if (filter.gte || filter.lte) {
      if (filter.selectFields === 'bookingDate') {
        where.bookingDate = { gte: filter.gte, lte: filter.lte };
      } else {
        where.bookingDate = { gte: filter.gte };
      }
    }

    if (filter.statuses && filter.statuses.length > 0) {
      where.status = { in: filter.statuses as BookingStatus[] };
    }

    let select: Prisma.BookingSelect;
    switch (filter.selectFields) {
      case 'status_source':
        select = { status: true, source: true };
        break;
      case 'status':
        select = { status: true };
        break;
      case 'patientProfileId':
        select = { patientProfileId: true };
        break;
      default:
        select = { bookingDate: true };
    }

    return this.prisma.booking.findMany({
      where,
      select,
    }) as unknown as Promise<Partial<Booking>[]>;
  }

  findRecentBookingsForDoctor(
    userId: string,
    limit = 10,
  ): Promise<
    Prisma.BookingGetPayload<{
      select: {
        id: true;
        bookingDate: true;
        startTime: true;
        status: true;
        patientProfile: { select: { fullName: true; patientCode: true } };
        service: { select: { name: true } };
        medicalRecord: { select: { diagnosisName: true } };
      };
    }>[]
  > {
    return this.prisma.booking.findMany({
      where: {
        doctorId: userId,
        status: {
          in: [
            'COMPLETED',
            'IN_PROGRESS',
            'NO_SHOW',
            'CANCELLED',
          ] as BookingStatus[],
        },
      },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        status: true,
        patientProfile: { select: { fullName: true, patientCode: true } },
        service: { select: { name: true } },
        medicalRecord: { select: { diagnosisName: true } },
      },
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      take: limit,
    });
  }

  async findTodayBookingsForDoctor(userId: string): Promise<
    Prisma.BookingGetPayload<{
      select: {
        id: true;
        startTime: true;
        endTime: true;
        status: true;
        source: true;
        patientProfile: { select: { fullName: true } };
        service: { select: { name: true } };
      };
    }>[]
  > {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    return this.prisma.booking.findMany({
      where: {
        doctorId: userId,
        bookingDate: { gte: today, lt: tomorrow },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        source: true,
        patientProfile: { select: { fullName: true } },
        service: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  findBookingsForHeatmap(filter: {
    doctorId: string;
    gte: Date;
    statuses: string[];
  }): Promise<Array<{ bookingDate: Date; startTime: string | null }>> {
    return this.prisma.booking.findMany({
      where: {
        doctorId: filter.doctorId,
        bookingDate: { gte: filter.gte },
        status: { in: filter.statuses as BookingStatus[] },
      },
      select: { bookingDate: true, startTime: true },
    }) as unknown as Promise<
      Array<{ bookingDate: Date; startTime: string | null }>
    >;
  }

  async findAllPatientIdsForDoctor(
    userId: string,
  ): Promise<Array<{ patientProfileId: string }>> {
    return this.prisma.booking.findMany({
      where: { doctorId: userId },
      select: { patientProfileId: true },
    });
  }

  findBookingsForClinicalKPIs(filter: {
    doctorId: string;
    gte: Date;
    statuses: string[];
  }): Promise<
    Array<{
      patientProfileId: string;
      queueRecord: { estimatedWaitMinutes: number | null } | null;
    }>
  > {
    return this.prisma.booking.findMany({
      where: {
        doctorId: filter.doctorId,
        bookingDate: { gte: filter.gte },
        status: { in: filter.statuses as BookingStatus[] },
      },
      select: {
        patientProfileId: true,
        queueRecord: { select: { estimatedWaitMinutes: true } },
      },
    }) as unknown as Promise<
      Array<{
        patientProfileId: string;
        queueRecord: { estimatedWaitMinutes: number | null } | null;
      }>
    >;
  }

  async countDoctorBookings(
    doctorId: string,
    filter?: { status?: string | string[]; gte?: Date; lte?: Date },
  ): Promise<number> {
    const statuses = filter?.status
      ? Array.isArray(filter.status)
        ? (filter.status as BookingStatus[])
        : [filter.status as BookingStatus]
      : undefined;

    const dateQuery =
      filter?.gte || filter?.lte
        ? {
            gte: filter.gte,
            ...(filter.lte ? { lte: filter.lte } : {}),
          }
        : undefined;

    return this.prisma.booking.count({
      where: {
        doctorId,
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(dateQuery ? { createdAt: dateQuery } : {}),
      },
    });
  }

  findDoctorCompletedServices(
    doctorId: string,
  ): Promise<Array<{ service: { name: string } | null }>> {
    return this.prisma.booking.findMany({
      where: {
        doctorId,
        status: 'COMPLETED',
        serviceId: { not: null },
      },
      select: {
        service: {
          select: {
            name: true,
          },
        },
      },
    }) as unknown as Promise<Array<{ service: { name: string } | null }>>;
  }

  async getBookingCountBySource(
    gteDate: Date,
    lteDate?: Date,
  ): Promise<Array<{ source: string; count: number }>> {
    const rows = await this.prisma.booking.groupBy({
      by: ['source'],
      where: {
        createdAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
      _count: {
        _all: true,
      },
    });

    return rows.map((r) => ({
      source: r.source,
      count: r._count?._all ?? 0,
    }));
  }

  async getBookingCountByStatus(
    gteDate: Date,
    lteDate?: Date,
  ): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.prisma.booking.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: gteDate,
          ...(lteDate ? { lte: lteDate } : {}),
        },
      },
      _count: {
        _all: true,
      },
    });

    return rows.map((r) => ({
      status: r.status,
      count: r._count?._all ?? 0,
    }));
  }

  async countTotalBookings(): Promise<number> {
    return this.prisma.booking.count();
  }

  async countUpcomingBookings(
    now: Date,
    gte?: Date,
    lte?: Date,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        bookingDate: { gte: now },
        ...(gte || lte
          ? {
              createdAt: {
                ...(gte ? { gte } : {}),
                ...(lte ? { lte } : {}),
              },
            }
          : {}),
      },
    });
  }

  async countActiveBookingsForService(serviceId: string): Promise<number> {
    return this.prisma.booking.count({
      where: {
        serviceId,
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

  createScheduleSlot(
    data: Prisma.DoctorScheduleSlotUncheckedCreateInput,
  ): Promise<DoctorScheduleSlot> {
    return this.prisma.doctorScheduleSlot.create({
      data,
    });
  }

  updateScheduleSlot(
    id: string,
    data: Prisma.DoctorScheduleSlotUncheckedUpdateInput,
  ): Promise<DoctorScheduleSlot> {
    return this.prisma.doctorScheduleSlot.update({
      where: { id },
      data,
    });
  }
}
