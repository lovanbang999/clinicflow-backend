import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
import { ApiException } from '../../common/exceptions/api.exception';
import { MessageCodes } from '../../common/constants/message-codes.const';
import {
  I_PROFILE_REPOSITORY,
  IProfileRepository,
} from '../database/interfaces/profile.repository.interface';
import {
  I_CLINICAL_REPOSITORY,
  IClinicalRepository,
} from '../database/interfaces/clinical.repository.interface';
import {
  I_FINANCE_REPOSITORY,
  IFinanceRepository,
} from '../database/interfaces/finance.repository.interface';
import {
  I_BOOKING_REPOSITORY,
  IBookingRepository,
} from '../database/interfaces/booking.repository.interface';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(I_PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(I_CLINICAL_REPOSITORY)
    private readonly clinicalRepository: IClinicalRepository,
    @Inject(I_FINANCE_REPOSITORY)
    private readonly financeRepository: IFinanceRepository,
    @Inject(I_BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  // PATIENT ANALYTICS

  async getPatientVisitTrend(userId: string) {
    const profile = await this.profileRepository.findFirstPatientProfile({
      where: { userId },
    });
    if (!profile)
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient profile not found',
        HttpStatus.NOT_FOUND,
      );

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const records = await this.clinicalRepository.findManyMedicalRecord({
      where: {
        patientProfileId: profile.id,
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { createdAt: true },
    });

    // Build a full 12-month bucket map (including empty months)
    const monthMap: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = 0;
    }

    for (const r of records) {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthMap) monthMap[key]++;
    }

    const trend = Object.entries(monthMap).map(([month, count]) => ({
      month,
      count,
    }));

    return ResponseHelper.success(
      trend,
      'ANALYTICS.PATIENT_VISIT_TREND',
      'Visit trend retrieved',
    );
  }

  async getPatientTopDiseases(userId: string) {
    const profile = await this.profileRepository.findFirstPatientProfile({
      where: { userId },
    });
    if (!profile)
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient profile not found',
        HttpStatus.NOT_FOUND,
      );

    const records = await this.clinicalRepository.findManyMedicalRecord({
      where: {
        patientProfileId: profile.id,
        diagnosisName: { not: null },
      },
      select: { diagnosisCode: true, diagnosisName: true },
    });

    const freq: Record<
      string,
      { code: string | null; name: string; count: number }
    > = {};
    for (const r of records) {
      const key = r.diagnosisCode || r.diagnosisName!;
      if (!freq[key]) {
        freq[key] = { code: r.diagnosisCode, name: r.diagnosisName!, count: 0 };
      }
      freq[key].count++;
    }

    const topDiseases = Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return ResponseHelper.success(
      topDiseases,
      'ANALYTICS.PATIENT_TOP_DISEASES',
      'Top diseases retrieved',
    );
  }

  async getPatientTotalSpending(userId: string) {
    const profile = await this.profileRepository.findFirstPatientProfile({
      where: { userId },
    });
    if (!profile)
      throw new ApiException(
        MessageCodes.PATIENT_NOT_FOUND,
        'Patient profile not found',
        HttpStatus.NOT_FOUND,
      );

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [allTimeAgg, thisYearAgg] = await Promise.all([
      this.financeRepository.aggregateInvoice({
        where: { patientProfileId: profile.id, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      this.financeRepository.aggregateInvoice({
        where: {
          patientProfileId: profile.id,
          status: 'PAID',
          paidAt: { gte: startOfYear },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    return ResponseHelper.success(
      {
        total: Number(allTimeAgg._sum?.totalAmount ?? 0),
        thisYear: Number(thisYearAgg._sum?.totalAmount ?? 0),
      },
      'ANALYTICS.PATIENT_SPENDING',
      'Spending retrieved',
    );
  }

  // DOCTOR ANALYTICS

  async getDoctorTopDiagnoses(userId: string) {
    // userId here is User.id — doctor's user id
    const records = await this.clinicalRepository.findManyMedicalRecord({
      where: {
        doctorId: userId,
        diagnosisName: { not: null },
      },
      select: { diagnosisCode: true, diagnosisName: true },
    });

    const freq: Record<
      string,
      { code: string | null; name: string; count: number }
    > = {};
    for (const r of records) {
      const key = r.diagnosisCode || r.diagnosisName!;
      if (!freq[key]) {
        freq[key] = { code: r.diagnosisCode, name: r.diagnosisName!, count: 0 };
      }
      freq[key].count++;
    }

    const top = Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return ResponseHelper.success(
      top,
      'ANALYTICS.DOCTOR_TOP_DIAGNOSES',
      'Top diagnoses retrieved',
    );
  }

  async getDoctorBookingStatusBreakdown(userId: string) {
    const statuses: Array<'COMPLETED' | 'CANCELLED' | 'NO_SHOW'> = [
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ];

    const counts = await Promise.all(
      statuses.map((status) =>
        this.bookingRepository
          .countBooking({ where: { doctorId: userId, status } })
          .then((count: number) => ({ status, count })),
      ),
    );

    return ResponseHelper.success(
      counts,
      'ANALYTICS.DOCTOR_BOOKING_STATUS',
      'Booking status breakdown retrieved',
    );
  }

  async getDoctorPatientsPerMonth(userId: string) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const bookings = await this.bookingRepository.findManyBooking({
      where: {
        doctorId: userId,
        bookingDate: { gte: sixMonthsAgo },
        status: { in: ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS'] },
      },
      select: { bookingDate: true },
    });

    // Build 6-month map
    const monthMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = 0;
    }

    for (const b of bookings) {
      const d = new Date(b.bookingDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthMap) monthMap[key]++;
    }

    const trend = Object.entries(monthMap).map(([month, count]) => ({
      month,
      count,
    }));
    return ResponseHelper.success(
      trend,
      'ANALYTICS.DOCTOR_PATIENTS_PER_MONTH',
      'Patients per month retrieved',
    );
  }

  /** Summary stats with optional period filter (7d | month | 6m | year) */
  async getDoctorSummary(userId: string, period = 'month') {
    const now = new Date();
    let from: Date;
    let prevFrom: Date;
    let prevTo: Date;

    switch (period) {
      case '7d':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        prevFrom = new Date(from.getTime() - 7 * 86400000);
        prevTo = new Date(from.getTime() - 1);
        break;
      case '6m':
        from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        prevFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        prevTo = new Date(now.getFullYear(), now.getMonth() - 5, 0);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        prevFrom = new Date(now.getFullYear() - 1, 0, 1);
        prevTo = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default: // month
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevTo = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const [current, previous] = await Promise.all([
      this.bookingRepository.findManyBooking({
        where: { doctorId: userId, bookingDate: { gte: from } },
        select: { status: true, source: true },
      }),
      this.bookingRepository.findManyBooking({
        where: {
          doctorId: userId,
          bookingDate: { gte: prevFrom, lte: prevTo },
        },
        select: { status: true },
      }),
    ]);

    const total = current.length;
    const prevTotal = previous.length;
    const completed = current.filter((b) => b.status === 'COMPLETED').length;
    const prevCompleted = previous.filter(
      (b) => b.status === 'COMPLETED',
    ).length;
    const absentCancel = current.filter(
      (b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW',
    ).length;
    const prevAbsentCancel = previous.filter(
      (b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW',
    ).length;

    // Source breakdown
    const online = current.filter(
      (b) => (b as { source?: string }).source === 'ONLINE',
    ).length;
    const walkIn = current.filter(
      (b) => (b as { source?: string }).source === 'WALK_IN',
    ).length;
    const phone = current.filter(
      (b) => (b as { source?: string }).source === 'PHONE',
    ).length;
    const deltaTotal =
      prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
    const deltaCompleted =
      prevCompleted > 0
        ? Math.round(((completed - prevCompleted) / prevCompleted) * 100)
        : 0;
    const deltaAbsentCancel =
      prevAbsentCancel > 0
        ? Math.round(
            ((absentCancel - prevAbsentCancel) / prevAbsentCancel) * 100,
          )
        : 0;

    return ResponseHelper.success(
      {
        total,
        prevTotal,
        deltaTotal,
        completed,
        prevCompleted,
        deltaCompleted,
        absentCancel,
        prevAbsentCancel,
        deltaAbsentCancel,
        sourceBreakdown: { online, walkIn, phone },
        // Static KPI placeholders – would require more data in production
        avgMinutes: 18,
        rating: 4.8,
      },
      'ANALYTICS.DOCTOR_SUMMARY',
      'Doctor summary retrieved',
    );
  }

  /** Ten most recent patients seen by this doctor */
  async getDoctorRecentPatients(userId: string) {
    const bookings = await this.bookingRepository.findManyBooking({
      where: {
        doctorId: userId,
        status: { in: ['COMPLETED', 'IN_PROGRESS', 'NO_SHOW', 'CANCELLED'] },
      },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        status: true,
        patientProfile: {
          select: { fullName: true, patientCode: true },
        },
        service: { select: { name: true } },
        medicalRecord: { select: { diagnosisName: true } },
      },
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      take: 10,
    } as object);

    return ResponseHelper.success(
      bookings,
      'ANALYTICS.DOCTOR_RECENT_PATIENTS',
      'Recent patients retrieved',
    );
  }

  /** Today's appointments as a timeline for this doctor */
  async getDoctorTodaySchedule(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const bookings = await this.bookingRepository.findManyBooking({
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
    } as object);

    return ResponseHelper.success(
      bookings,
      'ANALYTICS.DOCTOR_TODAY_SCHEDULE',
      'Today schedule retrieved',
    );
  }

  /**
   * Booking count heatmap by hour × day-of-week.
   * Returns a 24-length array (hours 0-23), each element is a 7-length array (Sun=0 … Sat=6).
   * Only looks at the last 12 weeks so data stays relevant.
   */
  async getDoctorHeatmap(userId: string) {
    const now = new Date();
    const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

    const bookings = await this.bookingRepository.findManyBooking({
      where: {
        doctorId: userId,
        bookingDate: { gte: twelveWeeksAgo },
        status: { in: ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS', 'NO_SHOW'] },
      },
      select: { bookingDate: true, startTime: true },
    });

    // Build a 24×7 matrix initialised to 0
    const matrix: number[][] = Array.from(
      { length: 24 },
      () => Array(7).fill(0) as number[],
    );

    for (const b of bookings) {
      // day-of-week derived from bookingDate
      const dow = new Date(b.bookingDate).getDay(); // 0=Sun … 6=Sat
      // hour derived from startTime (stored as "HH:MM" or "HH:MM:SS")
      if (!b.startTime) continue;
      const hour = parseInt(String(b.startTime).split(':')[0], 10);
      if (hour >= 0 && hour < 24) {
        matrix[hour][dow]++;
      }
    }

    return ResponseHelper.success(
      matrix,
      'ANALYTICS.DOCTOR_HEATMAP',
      'Heatmap retrieved',
    );
  }

  /**
   * 6 real clinical KPIs for the doctor.
   * Computed from the last 6 months of data:
   *  1. avgWaitMinutes  – average estimatedWaitMinutes from BookingQueue
   *  2. returnRate      – % patients with > 1 booking with this doctor
   *  3. labOrderRate    – % completed visits that had at least 1 lab order
   *  4. icdUsageRate    – % medical records with an ICD-10 code set
   *  5. newPatientRate  – % patients visiting this doctor for the first time
   *  6. followUpRate    – % medical records with a followUpDate set
   */
  async getDoctorClinicalKPIs(userId: string) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Fetch bookings in parallel with medical records
    const [bookings, records] = await Promise.all([
      this.bookingRepository.findManyBooking({
        where: {
          doctorId: userId,
          bookingDate: { gte: sixMonthsAgo },
          status: { in: ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS'] },
        },
        select: {
          patientProfileId: true,
          queueRecord: { select: { estimatedWaitMinutes: true } },
        },
      }),
      this.clinicalRepository.findManyMedicalRecord({
        where: {
          doctorId: userId,
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          patientProfileId: true,
          diagnosisCode: true,
          followUpDate: true,
          labOrders: { select: { id: true } },
        },
      }),
    ]);

    const totalBookings = bookings.length;
    const totalRecords = records.length;

    // 1. Avg wait minutes
    const waits = (
      bookings as Array<{
        queueRecord?: { estimatedWaitMinutes?: number } | null;
      }>
    )
      .map((b) => b.queueRecord?.estimatedWaitMinutes ?? null)
      .filter((v): v is number => v !== null);
    const avgWaitMinutes = waits.length
      ? Math.round(waits.reduce((s, v) => s + v, 0) / waits.length)
      : 0;

    // 2 & 5. Return rate / new patient rate
    const allTimeBookings = await this.bookingRepository.findManyBooking({
      where: { doctorId: userId },
      select: { patientProfileId: true },
    });
    const visitCountByPatient: Record<string, number> = {};
    for (const b of allTimeBookings) {
      visitCountByPatient[b.patientProfileId] =
        (visitCountByPatient[b.patientProfileId] ?? 0) + 1;
    }
    const periodPatientIds = new Set(bookings.map((b) => b.patientProfileId));
    let returnPatients = 0;
    let newPatients = 0;
    for (const pid of periodPatientIds) {
      const count = visitCountByPatient[pid] ?? 0;
      if (count > 1) returnPatients++;
      else newPatients++;
    }
    const totalDistinct = periodPatientIds.size || 1;
    const returnRate = Math.round((returnPatients / totalDistinct) * 100);
    const newPatientRate = Math.round((newPatients / totalDistinct) * 100);

    // 3. Lab order rate
    const withLab = (records as Array<{ labOrders: unknown[] }>).filter(
      (r) => r.labOrders.length > 0,
    ).length;
    const labOrderRate = totalRecords
      ? Math.round((withLab / totalRecords) * 100)
      : 0;

    // 4. ICD-10 usage rate
    const withIcd = (records as Array<{ diagnosisCode: string | null }>).filter(
      (r) => !!r.diagnosisCode,
    ).length;
    const icdUsageRate = totalRecords
      ? Math.round((withIcd / totalRecords) * 100)
      : 0;

    // 6. Follow-up rate
    const withFollowUp = (
      records as Array<{ followUpDate: Date | null }>
    ).filter((r) => !!r.followUpDate).length;
    const followUpRate = totalRecords
      ? Math.round((withFollowUp / totalRecords) * 100)
      : 0;

    return ResponseHelper.success(
      {
        avgWaitMinutes,
        returnRate,
        labOrderRate,
        icdUsageRate,
        newPatientRate,
        followUpRate,
        meta: {
          totalBookings,
          totalRecords,
          periodMonths: 6,
        },
      },
      'ANALYTICS.DOCTOR_CLINICAL_KPIS',
      'Clinical KPIs retrieved',
    );
  }
}
