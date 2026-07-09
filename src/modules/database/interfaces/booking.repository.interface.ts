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
      breakStartTime?: string | null;
      breakEndTime?: string | null;
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
  findDoctorOffDayById(id: string): Promise<DoctorOffDay | null>;
  findOffDaysWithDoctor(where: Prisma.DoctorOffDayWhereInput): Promise<
    (DoctorOffDay & {
      doctor: { id: string; fullName: string; email: string };
    })[]
  >;
  updateDoctorOffDay(
    id: string,
    data: Prisma.DoctorOffDayUpdateInput,
  ): Promise<DoctorOffDay>;

  findDoctorScheduleSlot(
    doctorId: string,
    date: Date,
  ): Promise<DoctorScheduleSlot | null>;
  countDoctorScheduleSlot(
    args: Prisma.DoctorScheduleSlotCountArgs,
  ): Promise<number>;
  countActiveScheduleSlotsForRoom(
    roomId: string,
    dateGte: Date,
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
  countActiveBookingsForDoctorInSlot(
    doctorId: string,
    date: Date,
    startTime: string,
  ): Promise<number>;
  findConfirmedBookingsInTimeRange(
    startTime: Date,
    endTime: Date,
  ): Promise<ConfirmedBookingReminder[]>;
  findPendingOffDaysWithDoctor(): Promise<PendingOffDayWithDoctor[]>;

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
  createOnlinePreBookingTransaction(
    input: CreateOnlinePreBookingInput,
  ): Promise<BookingWithRelations>;
  createReceptionistBookingTransaction(
    input: CreateReceptionistBookingInput,
  ): Promise<BookingWithRelations>;
  createDirectServiceBookingTransaction(
    input: CreateDirectServiceBookingInput,
  ): Promise<BookingWithRelations>;
  assignServiceAndMoveToConfirmedTransaction(
    input: AssignServiceAndMoveToConfirmedInput,
  ): Promise<Booking>;
  updateBookingStatusTransaction(
    bookingId: string,
    status: BookingStatus,
    changedById: string,
    reason: string,
    doctorNotes?: string,
    extraData?: Prisma.BookingUpdateInput,
  ): Promise<BookingWithRelations>;

  countDailyWalkInBookings(doctorId: string, date: Date): Promise<number>;
  countConfirmedBookingsForSlot(
    doctorId: string,
    date: Date,
    timeSlot: string,
  ): Promise<number>;

  findBookingsPaginated(filterDto: {
    patientProfileId?: string;
    doctorId?: string;
    serviceId?: string;
    status?: BookingStatus;
    date?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<[BookingWithRelations[], number]>;
  findPatientBookingsPaginated(
    patientProfileId: string,
    statusFilter: string | undefined,
    page: number,
    limit: number,
  ): Promise<[BookingWithRelations[], number]>;
  getPatientStatsAndNextBooking(
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
  }>;
  findDoctorPatientsPaginated(
    doctorId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ patients: any[]; total: number }>;
  getReceptionistStats(
    today: Date,
    tomorrow: Date,
  ): Promise<{
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }>;
  findBookingsWithFilters(
    filters: Prisma.BookingWhereInput,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<[Prisma.BookingGetPayload<Prisma.BookingFindManyArgs>[], number]>;
  findBookingById(id: string): Promise<BookingDetail | null>;
  findBookingWithRelations(id: string): Promise<BookingWithRelations | null>;
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
  ): Promise<{ booking: BookingWithRelations; queue: BookingQueue }>;

  findBookingForQueue(bookingId: string): Promise<BookingForQueue | null>;
  findLatestQueuePosition(doctorId: string, queueDate: Date): Promise<number>;
  countCheckedInQueue(doctorId: string, queueDate: Date): Promise<number>;
  findQueueRecordsPaginated(
    doctorId?: string,
    date?: string,
    timeSlot?: string,
    page?: number,
    limit?: number,
  ): Promise<[QueueRecordDetail[], number]>;
  findActivePreBookingsForRecalculation(
    doctorId: string,
    bookingDate: Date,
  ): Promise<{ startTime: string | null; endTime: string | null }[]>;
  findActiveWalkInQueueForRecalculation(
    doctorId: string,
    bookingDate: Date,
  ): Promise<ActiveWalkInQueueForRecalculation[]>;

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
  ): Promise<ActiveWalkInQueueForRecalculation[]>;
  findFirstInQueue(
    doctorId: string,
    bookingDate: Date,
    timeSlot: string,
  ): Promise<FirstInQueueDetail | null>;
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

  // Custom methods to prevent Prisma leakage in BillingService
  findTreatmentRelationship(
    doctorId: string,
    patientProfileId: string,
  ): Promise<Booking | null>;
  findBookingForInvoiceCreation(
    bookingId: string,
  ): Promise<Prisma.BookingGetPayload<{
    include: {
      service: true;
      patientProfile: { select: { id: true; fullName: true } };
    };
  }> | null>;
  findBookingPatientProfileId(
    bookingId: string,
  ): Promise<Prisma.BookingGetPayload<{
    select: { id: true; patientProfileId: true };
  }> | null>;
  findWorkspaceQueueBookings(params: {
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
  >;
  findBookingsWithInvoicesInDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<
    Prisma.BookingGetPayload<{
      include: {
        invoices: true;
      };
    }>[]
  >;
  findTechnicians(): Promise<
    Prisma.UserGetPayload<{
      select: { id: true };
    }>[]
  >;
  hasTreatmentRelationship(
    doctorId: string,
    patientProfileId: string,
  ): Promise<boolean>;
  countActiveBookingsForPatient(patientProfileId: string): Promise<number>;
  countActiveWalkInBookings(
    doctorId: string,
    bookingDate: Date,
  ): Promise<number>;
  findActiveBookingForPatient(
    patientProfileId: string,
    doctorId: string,
    bookingDate: Date,
  ): Promise<Booking | null>;
  findOverduePreBookings(
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
  >;
  getDoctorBookingStats(
    doctorId: string,
    startOfToday: Date,
    endOfToday: Date,
  ): Promise<{
    patientsSeenToday: number;
    totalPatientsSeen: number;
    pendingActive: number;
  }>;
  findBookingForPostVisitEmail(
    bookingId: string,
  ): Promise<Prisma.BookingGetPayload<{
    include: {
      patientProfile: { include: { user: { select: { email: true } } } };
      doctor: true;
      service: true;
    };
  }> | null>;
  findPatientLastAndNextBookings(
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
  >;
  getBookingDashboardStats(params: {
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
  }>;
  getScheduleDashboardStats(
    today: Date,
    endOfToday: Date,
  ): Promise<{
    totalAppointments: number;
    todaysSlots: number;
    canceledToday: number;
    avgWaitTime: number;
  }>;
  findAdminScheduleSlots(filters: {
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
  >;
  findAdminScheduleSlotDetail(
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
  }> | null>;
  getMostBookedServiceId(): Promise<{
    serviceId: string;
    count: number;
  } | null>;
  getServiceBookingStats(serviceId: string): Promise<{
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
  }>;

  // Analytics-oriented methods
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
  >;

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
  }): Promise<Partial<Booking>[]>;

  findRecentBookingsForDoctor(
    userId: string,
    limit?: number,
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
  >;

  findTodayBookingsForDoctor(userId: string): Promise<
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
  >;

  findBookingsForHeatmap(filter: {
    doctorId: string;
    gte: Date;
    statuses: string[];
  }): Promise<Array<{ bookingDate: Date; startTime: string | null }>>;

  findAllPatientIdsForDoctor(
    userId: string,
  ): Promise<Array<{ patientProfileId: string }>>;

  findBookingsForClinicalKPIs(filter: {
    doctorId: string;
    gte: Date;
    statuses: string[];
  }): Promise<
    Array<{
      patientProfileId: string;
      queueRecord: { estimatedWaitMinutes: number | null } | null;
    }>
  >;

  groupByBooking(args: Prisma.BookingGroupByArgs): Promise<unknown[]>;
  countBookingsByDateRange(gte?: Date, lte?: Date): Promise<number>;
  countCheckInsForDateRange(gte: Date, lte?: Date): Promise<number>;
  countBookingsByStatusAndDateRange(
    status: string | string[],
    gte?: Date,
    lte?: Date,
    dateField?: 'createdAt' | 'bookingDate' | 'checkedInAt',
  ): Promise<number>;
  countDoctorBookings(
    doctorId: string,
    filter?: { status?: string | string[]; gte?: Date; lte?: Date },
  ): Promise<number>;
  findDoctorCompletedServices(
    doctorId: string,
  ): Promise<Array<{ service: { name: string } | null }>>;
  getBookingCountBySource(
    gteDate: Date,
    lteDate?: Date,
  ): Promise<Array<{ source: string; count: number }>>;
  getBookingCountByStatus(
    gteDate: Date,
    lteDate?: Date,
  ): Promise<Array<{ status: string; count: number }>>;
  countTotalBookings(): Promise<number>;
  countUpcomingBookings(now: Date, gte?: Date, lte?: Date): Promise<number>;
  countActiveBookingsForService(serviceId: string): Promise<number>;
  createScheduleSlot(
    data: Prisma.DoctorScheduleSlotUncheckedCreateInput,
  ): Promise<DoctorScheduleSlot>;
  updateScheduleSlot(
    id: string,
    data: Prisma.DoctorScheduleSlotUncheckedUpdateInput,
  ): Promise<DoctorScheduleSlot>;
}
