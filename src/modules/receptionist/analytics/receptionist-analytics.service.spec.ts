import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionistAnalyticsService } from './receptionist-analytics.service';
import { I_FINANCE_REPOSITORY } from '../../database/interfaces/finance.repository.interface';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { I_PROFILE_REPOSITORY } from '../../database/interfaces/profile.repository.interface';

describe('ReceptionistAnalyticsService', () => {
  let service: ReceptionistAnalyticsService;
  let financeRepositoryMock: Record<string, jest.Mock>;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    financeRepositoryMock = {
      getTotalPaidRevenue: jest.fn(),
      countInvoicesByStatusAndDateRange: jest.fn(),
      getRevenueByInvoiceType: jest.fn(),
      findPaidInvoicesForAnalytics: jest.fn(),
      groupByPaymentMethod: jest.fn(),
      findPaidInvoicesWithServiceInfo: jest.fn(),
    };
    bookingRepositoryMock = {
      countCheckInsForDateRange: jest.fn(),
      getBookingCountBySource: jest.fn(),
      getBookingCountByStatus: jest.fn(),
    };
    profileRepositoryMock = {
      countPatientsByDateRange: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceptionistAnalyticsService,
        { provide: I_FINANCE_REPOSITORY, useValue: financeRepositoryMock },
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepositoryMock },
      ],
    }).compile();

    service = module.get<ReceptionistAnalyticsService>(
      ReceptionistAnalyticsService,
    );
  });

  describe('getOverview', () => {
    it('should aggregate stats for custom date ranges successfully', async () => {
      financeRepositoryMock.getTotalPaidRevenue.mockResolvedValue(5000);
      bookingRepositoryMock.countCheckInsForDateRange.mockResolvedValue(12);
      profileRepositoryMock.countPatientsByDateRange.mockResolvedValue(4);
      financeRepositoryMock.countInvoicesByStatusAndDateRange.mockResolvedValue(
        3,
      );
      financeRepositoryMock.getRevenueByInvoiceType.mockResolvedValue([
        { invoiceType: 'CONSULTATION', _sum: { totalAmount: 2000 } },
        { invoiceType: 'SERVICE', _sum: { totalAmount: 3000 } },
      ]);

      const result = await service.getOverview({
        from: '2028-12-01',
        to: '2028-12-05',
      });

      expect(result).toEqual({
        totalRevenue: 5000,
        checkIns: 12,
        newPatients: 4,
        pendingInvoices: 3,
        revenueByCategory: {
          CONSULTATION: 2000,
          SERVICE: 3000,
          PHARMACY: 0,
        },
      });

      expect(financeRepositoryMock.getTotalPaidRevenue).toHaveBeenCalledWith(
        new Date('2028-12-01'),
        new Date('2028-12-05'),
      );
    });
  });

  describe('getRevenueTrend', () => {
    it('should group paid invoices daily within dates range', async () => {
      const now = new Date('2028-12-04T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const since = new Date(now);
      since.setDate(now.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const lastDate = new Date(since);
      lastDate.setDate(since.getDate() + 6);

      financeRepositoryMock.findPaidInvoicesForAnalytics.mockResolvedValue([
        { totalAmount: 1500, paidAt: lastDate },
      ]);

      const result = await service.getRevenueTrend({});

      expect(result.chart.length).toBe(7);
      const lastDateKey = lastDate.toISOString().split('T')[0];
      const match = result.chart.find((c) => c.date === lastDateKey);
      expect(match?.revenue).toBe(1500);

      jest.useRealTimers();
    });
  });

  describe('getOperationalStats', () => {
    it('should map booking sources, booking status, payments and top services successfully', async () => {
      bookingRepositoryMock.getBookingCountBySource.mockResolvedValue([
        { source: 'ONLINE', count: 10 },
        { source: 'WALK_IN', count: 5 },
      ]);
      bookingRepositoryMock.getBookingCountByStatus.mockResolvedValue([
        { status: 'COMPLETED', count: 12 },
        { status: 'CANCELLED', count: 3 },
      ]);
      financeRepositoryMock.groupByPaymentMethod.mockResolvedValue([
        {
          paymentMethod: 'CASH',
          _sum: { amountPaid: 1000 },
          _count: { _all: 5 },
        },
      ]);
      financeRepositoryMock.findPaidInvoicesWithServiceInfo.mockResolvedValue([
        {
          totalAmount: 120000,
          booking: { serviceId: 's-1', service: { name: 'Massage' } },
        },
      ]);

      const result = await service.getOperationalStats({});

      expect(result.bookingSources).toEqual([
        { label: 'ONLINE', value: 10 },
        { label: 'WALK_IN', value: 5 },
      ]);
      expect(result.appointmentStatuses).toEqual([
        { label: 'COMPLETED', value: 12 },
        { label: 'CANCELLED', value: 3 },
      ]);
      expect(result.paymentMethods).toEqual([
        { label: 'CASH', value: 1000, count: 5 },
      ]);
      expect(result.topServices).toEqual([
        { id: 's-1', name: 'Massage', count: 1, revenue: 120000 },
      ]);
    });
  });
});
