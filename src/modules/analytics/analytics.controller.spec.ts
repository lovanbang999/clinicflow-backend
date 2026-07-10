import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getPatientVisitTrend: jest.fn(),
      getPatientTopDiseases: jest.fn(),
      getPatientTotalSpending: jest.fn(),
      getDoctorTopDiagnoses: jest.fn(),
      getDoctorBookingStatusBreakdown: jest.fn(),
      getDoctorPatientsPerMonth: jest.fn(),
      getDoctorSummary: jest.fn(),
      getDoctorRecentPatients: jest.fn(),
      getDoctorTodaySchedule: jest.fn(),
      getDoctorHeatmap: jest.fn(),
      getDoctorClinicalKPIs: jest.fn(),
      getDoctorTopServices: jest.fn(),
      getDoctorWeeklyBookings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe('patient endpoints', () => {
    const req = { user: { id: 'pat-1' } };

    it('getPatientVisitTrend should delegate to service', async () => {
      serviceMock.getPatientVisitTrend.mockResolvedValue([
        { month: '2028-12', count: 1 },
      ]);
      const result = await controller.getPatientVisitTrend(req);
      expect(result).toEqual([{ month: '2028-12', count: 1 }]);
      expect(serviceMock.getPatientVisitTrend).toHaveBeenCalledWith('pat-1');
    });

    it('getPatientTopDiseases should delegate to service', async () => {
      serviceMock.getPatientTopDiseases.mockResolvedValue([]);
      const result = await controller.getPatientTopDiseases(req);
      expect(result).toEqual([]);
      expect(serviceMock.getPatientTopDiseases).toHaveBeenCalledWith('pat-1');
    });

    it('getPatientTotalSpending should delegate to service', async () => {
      serviceMock.getPatientTotalSpending.mockResolvedValue({
        total: 1000,
        thisYear: 500,
      });
      const result = await controller.getPatientTotalSpending(req);
      expect(result).toEqual({ total: 1000, thisYear: 500 });
      expect(serviceMock.getPatientTotalSpending).toHaveBeenCalledWith('pat-1');
    });
  });

  describe('doctor endpoints', () => {
    const req = { user: { id: 'doc-1' } };

    it('getDoctorTopDiagnoses should delegate to service', async () => {
      serviceMock.getDoctorTopDiagnoses.mockResolvedValue([]);
      const result = await controller.getDoctorTopDiagnoses(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorTopDiagnoses).toHaveBeenCalledWith('doc-1');
    });

    it('getDoctorBookingStatusBreakdown should delegate to service', async () => {
      serviceMock.getDoctorBookingStatusBreakdown.mockResolvedValue([]);
      const result = await controller.getDoctorBookingStatusBreakdown(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorBookingStatusBreakdown).toHaveBeenCalledWith(
        'doc-1',
      );
    });

    it('getDoctorPatientsPerMonth should delegate to service', async () => {
      serviceMock.getDoctorPatientsPerMonth.mockResolvedValue([]);
      const result = await controller.getDoctorPatientsPerMonth(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorPatientsPerMonth).toHaveBeenCalledWith(
        'doc-1',
      );
    });

    it('getDoctorSummary should delegate to service', async () => {
      serviceMock.getDoctorSummary.mockResolvedValue({});
      const result = await controller.getDoctorSummary(req, 'month');
      expect(result).toEqual({});
      expect(serviceMock.getDoctorSummary).toHaveBeenCalledWith(
        'doc-1',
        'month',
      );
    });

    it('getDoctorRecentPatients should delegate to service', async () => {
      serviceMock.getDoctorRecentPatients.mockResolvedValue([]);
      const result = await controller.getDoctorRecentPatients(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorRecentPatients).toHaveBeenCalledWith('doc-1');
    });

    it('getDoctorTodaySchedule should delegate to service', async () => {
      serviceMock.getDoctorTodaySchedule.mockResolvedValue([]);
      const result = await controller.getDoctorTodaySchedule(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorTodaySchedule).toHaveBeenCalledWith('doc-1');
    });

    it('getDoctorHeatmap should delegate to service', async () => {
      serviceMock.getDoctorHeatmap.mockResolvedValue([]);
      const result = await controller.getDoctorHeatmap(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorHeatmap).toHaveBeenCalledWith('doc-1');
    });

    it('getDoctorClinicalKPIs should delegate to service', async () => {
      serviceMock.getDoctorClinicalKPIs.mockResolvedValue({});
      const result = await controller.getDoctorClinicalKPIs(req);
      expect(result).toEqual({});
      expect(serviceMock.getDoctorClinicalKPIs).toHaveBeenCalledWith('doc-1');
    });

    it('getDoctorTopServices should delegate to service', async () => {
      serviceMock.getDoctorTopServices.mockResolvedValue([]);
      const result = await controller.getDoctorTopServices(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorTopServices).toHaveBeenCalledWith('doc-1');
    });

    it('getDoctorWeeklyBookings should delegate to service', async () => {
      serviceMock.getDoctorWeeklyBookings.mockResolvedValue([]);
      const result = await controller.getDoctorWeeklyBookings(req);
      expect(result).toEqual([]);
      expect(serviceMock.getDoctorWeeklyBookings).toHaveBeenCalledWith('doc-1');
    });
  });
});
