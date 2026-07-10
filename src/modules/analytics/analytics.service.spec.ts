import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { HttpStatus } from '@nestjs/common';
import { I_PROFILE_REPOSITORY } from '../database/interfaces/profile.repository.interface';
import { I_CLINICAL_REPOSITORY } from '../database/interfaces/clinical.repository.interface';
import { I_FINANCE_REPOSITORY } from '../database/interfaces/finance.repository.interface';
import { I_BOOKING_REPOSITORY } from '../database/interfaces/booking.repository.interface';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let clinicalRepositoryMock: Record<string, jest.Mock>;
  let financeRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    profileRepositoryMock = {
      findPatientProfileByUserId: jest.fn(),
    };
    clinicalRepositoryMock = {
      findMedicalRecordsForVisitTrend: jest.fn(),
      findDiagnosisRecords: jest.fn(),
      findMedicalRecordsForKPIs: jest.fn(),
    };
    financeRepositoryMock = {
      getPatientRevenueStats: jest.fn(),
      getDoctorConsultationRevenue: jest.fn(),
    };
    bookingRepositoryMock = {
      countDoctorBookings: jest.fn(),
      findBookingsForDoctorAnalytics: jest.fn(),
      findRecentBookingsForDoctor: jest.fn(),
      findTodayBookingsForDoctor: jest.fn(),
      findBookingsForHeatmap: jest.fn(),
      findBookingsForClinicalKPIs: jest.fn(),
      findAllPatientIdsForDoctor: jest.fn(),
      findDoctorCompletedServices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepositoryMock },
        { provide: I_CLINICAL_REPOSITORY, useValue: clinicalRepositoryMock },
        { provide: I_FINANCE_REPOSITORY, useValue: financeRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('patient visit trend', () => {
    it('should throw exception if patient profile is not found', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue(null);

      await expect(service.getPatientVisitTrend('usr-1')).rejects.toThrow(
        new ApiException(
          'PATIENT.NOT_FOUND',
          'Patient profile not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should map medical records into a 12-month trend bucket', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue({
        id: 'p-1',
      });
      const now = new Date();
      // One record from today, one from 2 months ago
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);
      clinicalRepositoryMock.findMedicalRecordsForVisitTrend.mockResolvedValue([
        { createdAt: now },
        { createdAt: twoMonthsAgo },
      ]);

      const trend = await service.getPatientVisitTrend('usr-1');

      expect(trend.length).toBe(12);
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prev2MonthKey = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

      const currentBucket = trend.find((t) => t.month === currentMonthKey);
      const prev2Bucket = trend.find((t) => t.month === prev2MonthKey);

      expect(currentBucket?.count).toBe(1);
      expect(prev2Bucket?.count).toBe(1);
    });
  });

  describe('patient top diseases', () => {
    it('should throw if patient profile is not found', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue(null);
      await expect(service.getPatientTopDiseases('usr-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should aggregate diagnosis codes and names sorted by frequency', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue({
        id: 'p-1',
      });
      clinicalRepositoryMock.findDiagnosisRecords.mockResolvedValue([
        { diagnosisCode: 'A09', diagnosisName: 'Gastroenteritis' },
        { diagnosisCode: 'A09', diagnosisName: 'Gastroenteritis' },
        { diagnosisCode: 'J00', diagnosisName: 'Common Cold' },
      ]);

      const result = await service.getPatientTopDiseases('usr-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'A09',
        name: 'Gastroenteritis',
        count: 2,
      });
      expect(result[1]).toEqual({ code: 'J00', name: 'Common Cold', count: 1 });
    });
  });

  describe('patient total spending', () => {
    it('should throw if patient profile is not found', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue(null);
      await expect(service.getPatientTotalSpending('usr-1')).rejects.toThrow(
        ApiException,
      );
    });

    it('should return total spending and this year spending', async () => {
      profileRepositoryMock.findPatientProfileByUserId.mockResolvedValue({
        id: 'p-1',
      });
      financeRepositoryMock.getPatientRevenueStats.mockImplementation(
        (patientId: string, fromDate?: Date) => {
          return Promise.resolve(fromDate ? 500000 : 1500000);
        },
      );

      const result = await service.getPatientTotalSpending('usr-1');

      expect(result.total).toBe(1500000);
      expect(result.thisYear).toBe(500000);
    });
  });

  describe('doctor top diagnoses', () => {
    it('should return top diagnoses sorted by frequency', async () => {
      clinicalRepositoryMock.findDiagnosisRecords.mockResolvedValue([
        { diagnosisCode: 'I10', diagnosisName: 'Hypertension' },
        { diagnosisCode: 'I10', diagnosisName: 'Hypertension' },
        { diagnosisCode: 'E11', diagnosisName: 'Diabetes Type 2' },
      ]);

      const result = await service.getDoctorTopDiagnoses('doc-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'I10',
        name: 'Hypertension',
        count: 2,
      });
      expect(result[1]).toEqual({
        code: 'E11',
        name: 'Diabetes Type 2',
        count: 1,
      });
    });
  });

  describe('doctor booking status breakdown', () => {
    it('should count bookings by status successfully', async () => {
      bookingRepositoryMock.countDoctorBookings.mockImplementation(
        (doctorId: string, filter: { status: string }) => {
          if (filter.status === 'COMPLETED') return Promise.resolve(10);
          if (filter.status === 'CANCELLED') return Promise.resolve(2);
          if (filter.status === 'NO_SHOW') return Promise.resolve(1);
          return Promise.resolve(0);
        },
      );

      const breakdown = await service.getDoctorBookingStatusBreakdown('doc-1');

      expect(breakdown).toEqual([
        { status: 'COMPLETED', count: 10 },
        { status: 'CANCELLED', count: 2 },
        { status: 'NO_SHOW', count: 1 },
      ]);
    });
  });

  describe('doctor patients per month', () => {
    it('should bucket patients seen in last 6 months', async () => {
      const now = new Date();
      const threeMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 3,
        15,
      );
      bookingRepositoryMock.findBookingsForDoctorAnalytics.mockResolvedValue([
        { bookingDate: now },
        { bookingDate: threeMonthsAgo },
      ]);

      const trend = await service.getDoctorPatientsPerMonth('doc-1');

      expect(trend).toHaveLength(6);
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prev3MonthKey = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

      const currentBucket = trend.find((t) => t.month === currentMonthKey);
      const prev3Bucket = trend.find((t) => t.month === prev3MonthKey);

      expect(currentBucket?.count).toBe(1);
      expect(prev3Bucket?.count).toBe(1);
    });
  });

  describe('doctor summary', () => {
    it('should calculate summary stats and growth correctly for a period', async () => {
      bookingRepositoryMock.findBookingsForDoctorAnalytics.mockImplementation(
        (filter: { gte: Date; lte?: Date }) => {
          // Mock current period: 3 completed bookings, 1 cancelled, online source
          if (!filter.lte) {
            return Promise.resolve([
              { status: 'COMPLETED', source: 'ONLINE' },
              { status: 'COMPLETED', source: 'ONLINE' },
              { status: 'COMPLETED', source: 'WALK_IN' },
              { status: 'CANCELLED', source: 'PHONE' },
            ]);
          }
          // Mock previous period: 2 completed bookings, 0 cancelled
          return Promise.resolve([
            { status: 'COMPLETED', source: 'ONLINE' },
            { status: 'COMPLETED', source: 'ONLINE' },
          ]);
        },
      );

      financeRepositoryMock.getDoctorConsultationRevenue.mockImplementation(
        (doctorId: string, fromDate: Date, toDate?: Date) => {
          if (!toDate) return Promise.resolve(1000); // current revenue
          return Promise.resolve(500); // prev revenue
        },
      );

      const summary = await service.getDoctorSummary('doc-1', 'month');

      expect(summary.total).toBe(4);
      expect(summary.prevTotal).toBe(2);
      expect(summary.deltaTotal).toBe(100); // (4-2)/2 * 100
      expect(summary.completed).toBe(3);
      expect(summary.prevCompleted).toBe(2);
      expect(summary.deltaCompleted).toBe(50); // (3-2)/2 * 100
      expect(summary.absentCancel).toBe(1); // 1 CANCELLED
      expect(summary.prevAbsentCancel).toBe(0);
      expect(summary.deltaAbsentCancel).toBe(0);
      expect(summary.revenue).toBe(1000);
      expect(summary.prevRevenue).toBe(500);
      expect(summary.deltaRevenue).toBe(100); // (1000-500)/500 * 100
      expect(summary.sourceBreakdown).toEqual({
        online: 2,
        walkIn: 1,
        phone: 1,
      });
    });
  });

  describe('doctor recent patients & today schedule', () => {
    it('should fetch recent patients successfully', async () => {
      const mockList = [
        { id: 'bk-1', patientProfile: { fullName: 'Patient A' } },
      ];
      bookingRepositoryMock.findRecentBookingsForDoctor.mockResolvedValue(
        mockList,
      );

      const result = await service.getDoctorRecentPatients('doc-1');
      expect(result).toEqual(mockList);
      expect(
        bookingRepositoryMock.findRecentBookingsForDoctor,
      ).toHaveBeenCalledWith('doc-1', 10);
    });

    it('should fetch today schedule successfully', async () => {
      const mockTimeline = [{ id: 'bk-2', startTime: '09:00' }];
      bookingRepositoryMock.findTodayBookingsForDoctor.mockResolvedValue(
        mockTimeline,
      );

      const result = await service.getDoctorTodaySchedule('doc-1');
      expect(result).toEqual(mockTimeline);
      expect(
        bookingRepositoryMock.findTodayBookingsForDoctor,
      ).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('doctor heatmap', () => {
    it('should build a 24x7 heatmap matrix of booking counts', async () => {
      bookingRepositoryMock.findBookingsForHeatmap.mockResolvedValue([
        // Sunday (dow = 0) at 09:00
        { bookingDate: new Date('2028-12-03'), startTime: '09:00' },
        // Monday (dow = 1) at 14:30
        { bookingDate: new Date('2028-12-04'), startTime: '14:30' },
      ]);

      const matrix = await service.getDoctorHeatmap('doc-1');

      expect(matrix).toHaveLength(24);
      expect(matrix[0]).toHaveLength(7);
      expect(matrix[9][0]).toBe(1); // 09:00, Sun
      expect(matrix[14][1]).toBe(1); // 14:00, Mon
    });
  });

  describe('doctor clinical KPIs', () => {
    it('should compute waiting times, return rates and other KPIs correctly', async () => {
      bookingRepositoryMock.findBookingsForClinicalKPIs.mockResolvedValue([
        { patientProfileId: 'p-1', queueRecord: { estimatedWaitMinutes: 10 } },
        { patientProfileId: 'p-2', queueRecord: { estimatedWaitMinutes: 20 } },
        { patientProfileId: 'p-1', queueRecord: null },
      ]);

      clinicalRepositoryMock.findMedicalRecordsForKPIs.mockResolvedValue([
        {
          id: 'mr-1',
          diagnosisCode: 'A09',
          followUpDate: new Date(),
          labOrders: [1],
        },
        { id: 'mr-2', diagnosisCode: null, followUpDate: null, labOrders: [] },
      ]);

      bookingRepositoryMock.findAllPatientIdsForDoctor.mockResolvedValue([
        { patientProfileId: 'p-1' },
        { patientProfileId: 'p-1' }, // p-1 has multiple bookings -> return rate
        { patientProfileId: 'p-2' }, // p-2 has only one -> new patient
      ]);

      const kpi = await service.getDoctorClinicalKPIs('doc-1');

      expect(kpi.avgWaitMinutes).toBe(15); // (10 + 20) / 2
      expect(kpi.returnRate).toBe(50); // 1 out of 2 distinct patients is a return patient (p-1)
      expect(kpi.newPatientRate).toBe(50); // 1 out of 2 is a new patient (p-2)
      expect(kpi.labOrderRate).toBe(50); // 1 out of 2 medical records had lab orders
      expect(kpi.icdUsageRate).toBe(50); // 1 out of 2 had diagnosis code
      expect(kpi.followUpRate).toBe(50); // 1 out of 2 had follow up date
    });
  });

  describe('doctor top services & weekly bookings', () => {
    it('should group and sort doctor top services successfully', async () => {
      bookingRepositoryMock.findDoctorCompletedServices.mockResolvedValue([
        { service: { name: 'General Consultation' } },
        { service: { name: 'General Consultation' } },
        { service: { name: 'Blood Test' } },
      ]);

      const result = await service.getDoctorTopServices('doc-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'General Consultation', count: 2 });
      expect(result[1]).toEqual({ name: 'Blood Test', count: 1 });
    });

    it('should aggregate weekly booking counts by day of week correctly', async () => {
      // Mon (Dec 4, 2028 is Monday)
      bookingRepositoryMock.findBookingsForDoctorAnalytics.mockResolvedValue([
        { bookingDate: new Date('2028-12-04T10:00:00') }, // Monday
        { bookingDate: new Date('2028-12-04T11:00:00') }, // Monday
        { bookingDate: new Date('2028-12-05T10:00:00') }, // Tuesday
      ]);

      const result = await service.getDoctorWeeklyBookings('doc-1');

      const mondayStats = result.find((r) => r.day === 'T2');
      const tuesdayStats = result.find((r) => r.day === 'T3');

      expect(mondayStats?.count).toBe(2);
      expect(tuesdayStats?.count).toBe(1);
    });
  });
});
