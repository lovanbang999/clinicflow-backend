import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsService } from './admin-analytics.service';
import { I_BOOKING_REPOSITORY } from 'src/modules/database/interfaces/booking.repository.interface';
import { I_FINANCE_REPOSITORY } from 'src/modules/database/interfaces/finance.repository.interface';
import { I_PROFILE_REPOSITORY } from 'src/modules/database/interfaces/profile.repository.interface';
import { I_USER_REPOSITORY } from 'src/modules/database/interfaces/user.repository.interface';
import { BookingStatus } from '@prisma/client';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let financeRepositoryMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    bookingRepositoryMock = {
      countBooking: jest.fn(),
      findBookingsForTopDoctors: jest.fn(),
      countBookingsByDateRange: jest.fn(),
    };
    financeRepositoryMock = {
      getRevenueByInvoiceType: jest.fn(),
      findPaidInvoicesForAnalytics: jest.fn(),
      groupByInvoice: jest.fn(),
      findPaidInvoicesWithServiceInfo: jest.fn(),
      findPaidInvoicesForReport: jest.fn(),
    };
    profileRepositoryMock = {
      countPatientProfile: jest.fn(),
    };
    userRepositoryMock = {
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
        { provide: I_FINANCE_REPOSITORY, useValue: financeRepositoryMock },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepositoryMock },
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  describe('getAnalyticsOverview', () => {
    it('should calculate overview KPIs and monthly trends with growth successfully', async () => {
      profileRepositoryMock.countPatientProfile.mockImplementation(
        (filter: { where?: { createdAt?: { gte?: Date } } }) => {
          if (filter.where?.createdAt?.gte) return Promise.resolve(5); // period patients
          return Promise.resolve(100); // total patients
        },
      );
      userRepositoryMock.count.mockResolvedValue(10); // total active doctors
      bookingRepositoryMock.countBooking.mockImplementation(
        (filter: { where?: { createdAt?: { gte?: Date } } }) => {
          if (filter.where?.createdAt?.gte) return Promise.resolve(20); // period bookings
          return Promise.resolve(500); // total bookings
        },
      );
      financeRepositoryMock.getRevenueByInvoiceType.mockResolvedValue([
        { invoiceType: 'CONSULTATION', _sum: { totalAmount: 1000 } },
        { invoiceType: 'SERVICE', _sum: { totalAmount: 2000 } },
      ]);

      const now = new Date();
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );

      // Invoices
      financeRepositoryMock.findPaidInvoicesForAnalytics.mockImplementation(
        (filter: { gte?: Date }) => {
          if (!filter.gte) {
            // allPaid
            return Promise.resolve([
              { id: 'inv-1', totalAmount: 1000, paidAt: now },
              {
                id: 'inv-2',
                totalAmount: 500,
                paidAt: new Date(startOfLastMonth.getTime() + 100000),
              },
            ]);
          }
          // currentPeriodInvoices
          return Promise.resolve([
            { id: 'inv-1', totalAmount: 1000, paidAt: now },
          ]);
        },
      );

      const result = await service.getAnalyticsOverview({});

      expect(result.totalUsers).toBe(100);
      expect(result.totalDoctors).toBe(10);
      expect(result.totalBookings).toBe(500);
      expect(result.totalRevenue).toBe(1500);
      expect(result.revenueByType).toEqual({
        CONSULTATION: 1000,
        SERVICE: 2000,
        PHARMACY: 0,
      });
      expect(result.trends.newPatientsThisMonth).toBe(5);
      expect(result.trends.currentMonthRevenue).toBe(1000);
      expect(result.trends.lastMonthRevenue).toBe(500);
      expect(result.trends.revenueGrowthPct).toBe(100); // (1000-500)/500 * 100
    });
  });

  describe('getTopDoctors', () => {
    it('should query and sort top doctors by revenue within date range', async () => {
      financeRepositoryMock.groupByInvoice.mockResolvedValue([
        { bookingId: 'bk-1', _sum: { totalAmount: 500000 } },
        { bookingId: 'bk-2', _sum: { totalAmount: 300000 } },
      ]);

      bookingRepositoryMock.findBookingsForTopDoctors.mockResolvedValue([
        {
          id: 'bk-1',
          doctorId: 'doc-1',
          doctor: {
            fullName: 'Dr. Strange',
            avatar: 'strange.png',
            doctorProfile: { specialties: ['Sorcery', 'Surgery'] },
          },
        },
        {
          id: 'bk-2',
          doctorId: 'doc-2',
          doctor: {
            fullName: 'Dr. House',
            avatar: null,
            doctorProfile: null,
          },
        },
      ]);

      const result = await service.getTopDoctors(5, {});

      expect(result.topDoctors).toHaveLength(2);
      expect(result.topDoctors[0]).toEqual({
        id: 'doc-1',
        name: 'Dr. Strange',
        avatar: 'strange.png',
        specialty: 'Sorcery',
        patientsCount: 1,
        revenue: 500000,
      });
      expect(result.topDoctors[1]).toEqual({
        id: 'doc-2',
        name: 'Dr. House',
        avatar: null,
        specialty: 'General',
        patientsCount: 1,
        revenue: 300000,
      });
    });
  });

  describe('getRevenueChart', () => {
    it('should generate revenue daily data points for week period', async () => {
      const now = new Date('2028-12-04T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const since = new Date(now);
      since.setDate(now.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const lastDate = new Date(since);
      lastDate.setDate(since.getDate() + 6);

      financeRepositoryMock.findPaidInvoicesForAnalytics.mockResolvedValue([
        { totalAmount: 1000, paidAt: lastDate },
      ]);

      const result = await service.getRevenueChart({ period: 'week' });

      expect(result.period).toBe('week');
      expect(result.chart.length).toBe(7);
      const expectedDayKey = lastDate.toISOString().split('T')[0];
      const match = result.chart.find((c) => c.date === expectedDayKey);
      expect(match?.revenue).toBe(1000);

      jest.useRealTimers();
    });

    it('should generate monthly data points when from/to range is provided', async () => {
      financeRepositoryMock.findPaidInvoicesForAnalytics.mockResolvedValue([
        { totalAmount: 5000, paidAt: new Date('2028-02-15T12:00:00.000Z') },
      ]);

      const result = await service.getRevenueChart({
        from: '2028-01-01',
        to: '2028-03-31',
      });

      expect(result.chart.length).toBe(3);
      const febMatch = result.chart.find((c) => c.date === '2028-02-01');
      expect(febMatch?.revenue).toBe(5000);
    });
  });

  describe('getBookingOverview', () => {
    it('should aggregate booking counts and calculate percentages by status', async () => {
      bookingRepositoryMock.countBooking.mockImplementation(
        (filter: { where?: { status?: string | { in: string[] } } }) => {
          if (!filter.where?.status) return Promise.resolve(10); // total
          if (filter.where.status === BookingStatus.COMPLETED)
            return Promise.resolve(6);
          if (filter.where.status === BookingStatus.CANCELLED)
            return Promise.resolve(2);
          // inProgress status has status in: ['CHECKED_IN', 'IN_PROGRESS']
          if (
            typeof filter.where.status === 'object' &&
            'in' in filter.where.status
          ) {
            return Promise.resolve(1);
          }
          // upcoming: PENDING, CONFIRMED
          return Promise.resolve(1);
        },
      );

      const result = await service.getBookingOverview();

      expect(result).toEqual({
        total: 10,
        completed: 6,
        upcoming: 1,
        cancelled: 2,
        inProgress: 1,
        completedPct: 60,
        upcomingPct: 10,
        cancelledPct: 20,
      });
    });
  });

  describe('getTopServices', () => {
    it('should aggregate service revenue and count successfully', async () => {
      financeRepositoryMock.findPaidInvoicesWithServiceInfo.mockResolvedValue([
        {
          totalAmount: 200000,
          booking: { serviceId: 's-1', service: { name: 'X-Ray' } },
        },
        {
          totalAmount: 100000,
          booking: { serviceId: 's-1', service: { name: 'X-Ray' } },
        },
        {
          totalAmount: 150000,
          booking: { serviceId: 's-2', service: { name: 'Ultrasound' } },
        },
      ]);

      const result = await service.getTopServices(5);

      expect(result.topServices).toHaveLength(2);
      expect(result.topServices[0]).toEqual({
        id: 's-1',
        name: 'X-Ray',
        bookingsCount: 2,
        estimatedRevenue: 300000,
      });
      expect(result.topServices[1]).toEqual({
        id: 's-2',
        name: 'Ultrasound',
        bookingsCount: 1,
        estimatedRevenue: 150000,
      });
    });
  });

  describe('getRevenueReport', () => {
    it('should aggregate and calculate detailed revenue parameters', async () => {
      financeRepositoryMock.findPaidInvoicesForReport.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'INV001',
          invoiceType: 'CONSULTATION',
          totalAmount: 50000,
          paidAt: new Date(),
          booking: {
            patientProfile: { fullName: 'Alice', patientCode: 'P-001' },
            doctor: { fullName: 'Dr. House' },
          },
          payments: [{ paymentMethod: 'CASH' }],
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV002',
          invoiceType: 'SERVICE',
          totalAmount: 150000,
          paidAt: new Date(),
          booking: null,
          payments: [{ paymentMethod: 'BANK_TRANSFER' }],
        },
      ]);

      const result = await service.getRevenueReport({});

      expect(result.summary.totalRevenue).toBe(200000);
      expect(result.summary.invoiceCount).toBe(2);
      expect(result.summary.averageOrderValue).toBe(100000);
      expect(result.summary.revenueByType).toEqual({
        CONSULTATION: 50000,
        SERVICE: 150000,
        PHARMACY: 0,
      });
      expect(result.summary.paymentMethodRevenue).toEqual({
        CASH: 50000,
        CARD: 0,
        BANK_TRANSFER: 150000,
        INSURANCE: 0,
      });

      expect(result.invoices[0].patientName).toBe('Alice');
      expect(result.invoices[1].patientName).toBe('Khách vãng lai');
    });
  });
});
