import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ResponseHelper } from '../../common/interfaces/api-response.interface';
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
    if (!profile) throw new NotFoundException('Patient profile not found');

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
    if (!profile) throw new NotFoundException('Patient profile not found');

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
    if (!profile) throw new NotFoundException('Patient profile not found');

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
}
