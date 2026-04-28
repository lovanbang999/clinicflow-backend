import {
  Prisma,
  BookingStatus,
  DayOfWeek,
  Booking,
  BookingQueue,
  DoctorWorkingHours,
  DoctorBreakTime,
  DoctorOffDay,
  DoctorScheduleSlot,
} from '@prisma/client';
import { TransactionClient } from './clinical.repository.interface';
import {
  BookingDetail,
  BookingWithDuration,
  BookingWithRelations,
  QueueRecordWithRelations,
  SlotReservation,
} from '../types/prisma-payload.types';

export const I_BOOKING_REPOSITORY = 'IBookingRepository';

export interface IBookingRepository {
  // Common counts
  countBookingsByService(
    serviceId: string,
    statuses?: string[],
  ): Promise<number>;
  countActiveAppointmentsGroup(startDate: Date): Promise<number>;

  // Generic Booking CRUD
  countBooking(args: Prisma.BookingCountArgs): Promise<number>;
  findFirstBooking<T extends Prisma.BookingFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindFirstArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null>;
  findManyBooking<T extends Prisma.BookingFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindManyArgs>,
  ): Promise<Prisma.BookingGetPayload<T>[]>;
  findUniqueBooking<T extends Prisma.BookingFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindUniqueArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null>;
  updateBooking(args: Prisma.BookingUpdateArgs): Promise<Booking>;
  createBooking(args: Prisma.BookingCreateArgs): Promise<Booking>;
  deleteBooking(args: Prisma.BookingDeleteArgs): Promise<Booking>;

  // === Schedules ===
  findDoctorWorkingHours(
    doctorId: string,
    dayOfWeek?: DayOfWeek,
  ): Promise<DoctorWorkingHours | null>;
  findWorkingHoursList(doctorId: string): Promise<DoctorWorkingHours[]>;
  createDoctorWorkingHours(
    data: Prisma.DoctorWorkingHoursCreateInput,
  ): Promise<DoctorWorkingHours>;
  updateDoctorWorkingHours(
    doctorId: string,
    dayOfWeek: DayOfWeek,
    data: Prisma.DoctorWorkingHoursUpdateInput,
  ): Promise<DoctorWorkingHours>;
  deleteDoctorWorkingHours(
    doctorId: string,
    dayOfWeek: DayOfWeek,
  ): Promise<DoctorWorkingHours>;
  bulkUpdateDoctorWorkingHoursTransaction(
    doctorId: string,
    items: {
      enabled: boolean;
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
    }[],
  ): Promise<DoctorWorkingHours[]>;

  createDoctorBreakTime(
    data: Prisma.DoctorBreakTimeCreateArgs,
  ): Promise<DoctorBreakTime>;
  findDoctorBreakTimes(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DoctorBreakTime[]>;
  deleteDoctorBreakTime(id: string): Promise<DoctorBreakTime>;

  createDoctorOffDayTransaction(
    data: Prisma.DoctorOffDayCreateInput,
    cancelAffected: boolean,
    affectedBookingIds: string[],
  ): Promise<DoctorOffDay>;
  findDoctorOffDays(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DoctorOffDay[]>;
  findDoctorOffDay(doctorId: string, date: Date): Promise<DoctorOffDay | null>;
  deleteDoctorOffDay(doctorId: string, date: Date): Promise<DoctorOffDay>;

  findDoctorScheduleSlot(
    doctorId: string,
    date: Date,
  ): Promise<DoctorScheduleSlot | null>;
  countDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotCountArgs,
  ): Promise<number>;
  findManyDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotFindManyArgs,
  ): Promise<
    Prisma.DoctorScheduleSlotGetPayload<Prisma.DoctorScheduleSlotFindManyArgs>[]
  >;
  findUniqueDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotFindUniqueArgs,
  ): Promise<Prisma.DoctorScheduleSlotGetPayload<Prisma.DoctorScheduleSlotFindUniqueArgs> | null>;
  createDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotCreateArgs,
  ): Promise<DoctorScheduleSlot>;
  updateDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotUpdateArgs,
  ): Promise<DoctorScheduleSlot>;

  // === Slot Reservations ===
  createSlotReservation(
    data: Omit<SlotReservation, 'id' | 'createdAt'>,
  ): Promise<SlotReservation>;
  findSlotReservation(
    doctorId: string,
    date: Date,
    startTime: string,
  ): Promise<SlotReservation | null>;
  findSlotReservations(
    doctorId: string,
    date: Date,
  ): Promise<SlotReservation[]>;
  deleteSlotReservation(id: string): Promise<SlotReservation>;
  deleteExpiredReservations(): Promise<Prisma.BatchPayload>;
  deleteSlotReservationByDetails(
    doctorId: string,
    date: Date,
    startTime: string,
    patientProfileId: string,
  ): Promise<Prisma.BatchPayload>;

  // === Bookings ===
  createPreBookingTransaction(
    data: Prisma.BookingCreateInput,
    changedById: string,
  ): Promise<Prisma.BookingGetPayload<{ include: { statusHistory: true } }>>;
  createWalkInBookingTransaction(
    data: Prisma.BookingCreateInput,
    changedById: string,
  ): Promise<
    Prisma.BookingGetPayload<{
      include: { statusHistory: true; queueRecord: true };
    }>
  >;

  countDailyWalkInBookings(doctorId: string, date: Date): Promise<number>;
  countConfirmedBookingsForSlot(
    doctorId: string,
    date: Date,
    timeSlot: string,
  ): Promise<number>;

  findBookingsWithFilters(
    filters: Prisma.BookingWhereInput,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<[Prisma.BookingGetPayload<Prisma.BookingFindManyArgs>[], number]>;
  findBookingById(id: string): Promise<BookingDetail | null>;
  findActiveExamination(doctorId: string): Promise<Booking | null>;
  findBookingsByPatient(patientId: string): Promise<BookingWithDuration[]>;
  findBookingsByDoctorAndDate(
    doctorId: string,
    date: Date,
  ): Promise<BookingWithDuration[]>;
  findAffectedBookingsForDateRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BookingWithRelations[]>;

  countBookingsByFilters(where: Prisma.BookingWhereInput): Promise<number>;
  findMostRecentBookingCode(prefix: string): Promise<Booking | null>;
  findDistinctPatientProfileIds(
    where: Prisma.BookingWhereInput,
    skip?: number,
    take?: number,
  ): Promise<{ patientProfileId: string }[]>;
  updateBookingEstimatedTime(id: string, estimatedTime: Date): Promise<void>;

  checkInTransaction(
    bookingId: string,
    doctorId: string,
    bookingDate: Date,
    isPreBooked: boolean,
    startTime: string | null,
    userId: string,
    estWaitMinutes: number,
    currentPosition: number,
  ): Promise<{ booking: Booking; queue: BookingQueue }>;

  updateBookingStatusTransaction(
    id: string,
    status: BookingStatus,
    reason: string,
    changedById: string,
    doctorNotes?: string,
    extraData?: Record<string, unknown>,
  ): Promise<Prisma.BookingGetPayload<{ include: { statusHistory: true } }>>;

  // === Queues ===
  findQueuesWithFilters(
    filters: Prisma.BookingQueueWhereInput,
    skip: number,
    take: number,
  ): Promise<[QueueRecordWithRelations[], number]>;
  findQueueByBookingId(
    bookingId: string,
  ): Promise<QueueRecordWithRelations | null>;
  getQueueStatistics(
    doctorId?: string,
    date?: Date,
  ): Promise<{
    totalQueued: number;
    avgWaitTime: number | null;
    longestQueue: number | null;
  }>;

  promoteQueueTransaction(
    bookingId: string,
    promotedBy: string,
    reason: string,
  ): Promise<Prisma.BookingQueueGetPayload<Prisma.BookingQueueFindUniqueArgs>>;
  findWalkInQueuesByDoctorAndDate(
    doctorId: string,
    date: Date,
  ): Promise<Prisma.BookingQueueGetPayload<Prisma.BookingQueueFindManyArgs>[]>;
  findFirstInQueue(
    doctorId: string,
    bookingDate: Date,
    timeSlot: string,
  ): Promise<Prisma.BookingQueueGetPayload<Prisma.BookingQueueFindFirstArgs> | null>;
  removeFromQueueAndShiftTransaction(bookingId: string): Promise<void>;

  // Generic delegates
  count(args: Prisma.BookingCountArgs): Promise<number>;
  findFirst<T extends Prisma.BookingFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindFirstArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null>;
  findMany<T extends Prisma.BookingFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindManyArgs>,
  ): Promise<Prisma.BookingGetPayload<T>[]>;
  findUnique<T extends Prisma.BookingFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingFindUniqueArgs>,
  ): Promise<Prisma.BookingGetPayload<T> | null>;
  update(args: Prisma.BookingUpdateArgs): Promise<Booking>;
  groupByBooking(args: Prisma.BookingGroupByArgs): Promise<unknown[]>;
  aggregateBooking(
    args: Prisma.BookingAggregateArgs,
  ): Promise<Prisma.GetBookingAggregateType<Prisma.BookingAggregateArgs>>;
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;

  // Queue delegates
  countQueue(args: Prisma.BookingQueueCountArgs): Promise<number>;
  findQueueMany<T extends Prisma.BookingQueueFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingQueueFindManyArgs>,
  ): Promise<Prisma.BookingQueueGetPayload<T>[]>;
  findQueueFirst<T extends Prisma.BookingQueueFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingQueueFindFirstArgs>,
  ): Promise<Prisma.BookingQueueGetPayload<T> | null>;
  findQueueUnique<T extends Prisma.BookingQueueFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BookingQueueFindUniqueArgs>,
  ): Promise<Prisma.BookingQueueGetPayload<T> | null>;
  aggregateQueue(
    args: Prisma.BookingQueueAggregateArgs,
  ): Promise<
    Prisma.GetBookingQueueAggregateType<Prisma.BookingQueueAggregateArgs>
  >;
  updateQueue(args: Prisma.BookingQueueUpdateArgs): Promise<BookingQueue>;
  deleteQueue(args: Prisma.BookingQueueDeleteArgs): Promise<BookingQueue>;
}
