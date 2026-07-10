import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardService } from './admin-dashboard.service';
import { I_BOOKING_REPOSITORY } from '../../database/interfaces/booking.repository.interface';
import { I_FINANCE_REPOSITORY } from '../../database/interfaces/finance.repository.interface';
import { I_PROFILE_REPOSITORY } from '../../database/interfaces/profile.repository.interface';
import { I_USER_REPOSITORY } from '../../database/interfaces/user.repository.interface';
import { BookingStatus } from '@prisma/client';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let bookingRepositoryMock: Record<string, jest.Mock>;
  let financeRepositoryMock: Record<string, jest.Mock>;
  let profileRepositoryMock: Record<string, jest.Mock>;
  let userRepositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    bookingRepositoryMock = {
      countTotalBookings: jest.fn(),
      countBookingsByDateRange: jest.fn(),
      countBookingsByStatusAndDateRange: jest.fn(),
    };
    financeRepositoryMock = {
      findPaidInvoicesForAnalytics: jest.fn(),
    };
    profileRepositoryMock = {
      countTotalPatients: jest.fn(),
      countPatientsByDateRange: jest.fn(),
    };
    userRepositoryMock = {
      countActiveDoctors: jest.fn(),
      countUsersByRoleAndDateRange: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: I_BOOKING_REPOSITORY, useValue: bookingRepositoryMock },
        { provide: I_FINANCE_REPOSITORY, useValue: financeRepositoryMock },
        { provide: I_PROFILE_REPOSITORY, useValue: profileRepositoryMock },
        { provide: I_USER_REPOSITORY, useValue: userRepositoryMock },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  describe('getDashboardOverview', () => {
    it('should aggregate metrics, handle comparison calculations and growth successfully', async () => {
      profileRepositoryMock.countTotalPatients.mockResolvedValue(50);
      userRepositoryMock.countActiveDoctors.mockResolvedValue(5);
      bookingRepositoryMock.countTotalBookings.mockResolvedValue(150);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );

      profileRepositoryMock.countPatientsByDateRange.mockImplementation(
        (gte: Date) => {
          if (gte.getTime() === startOfMonth.getTime())
            return Promise.resolve(10);
          return Promise.resolve(8);
        },
      );

      financeRepositoryMock.findPaidInvoicesForAnalytics.mockImplementation(
        (filter: { gte?: Date }) => {
          if (!filter.gte) {
            // allPaid
            return Promise.resolve([
              { id: 'inv-1', totalAmount: 1000, paidAt: now },
              {
                id: 'inv-2',
                totalAmount: 400,
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

      bookingRepositoryMock.countBookingsByDateRange.mockImplementation(
        (gte: Date) => {
          if (gte.getTime() === startOfMonth.getTime())
            return Promise.resolve(25);
          return Promise.resolve(20);
        },
      );

      const result = await service.getDashboardOverview({});

      expect(result.totalUsers).toBe(50);
      expect(result.totalDoctors).toBe(5);
      expect(result.totalBookings).toBe(150);
      expect(result.totalRevenue).toBe(1400);

      expect(result.trends.newPatientsThisMonth).toBe(10);
      expect(result.trends.newBookingsThisMonth).toBe(25);
      expect(result.trends.currentMonthRevenue).toBe(1000);
      expect(result.trends.lastMonthRevenue).toBe(400);
      expect(result.trends.revenueGrowthPct).toBe(150); // (1000-400)/400 * 100
    });
  });

  describe('getMonthlyStats', () => {
    it('should aggregate stats for custom month and compute success rate', async () => {
      bookingRepositoryMock.countBookingsByDateRange.mockResolvedValue(100);
      bookingRepositoryMock.countBookingsByStatusAndDateRange.mockImplementation(
        (status: string) => {
          if (status === BookingStatus.COMPLETED) return Promise.resolve(90);
          return Promise.resolve(0);
        },
      );
      userRepositoryMock.countUsersByRoleAndDateRange.mockResolvedValue(15);
      financeRepositoryMock.findPaidInvoicesForAnalytics.mockResolvedValue([
        { totalAmount: 30000 },
        { totalAmount: 20000 },
      ]);

      const result = await service.getMonthlyStats('2028-12');

      expect(result).toEqual({
        month: '2028-12',
        bookingCount: 100,
        newPatients: 15,
        successRate: 90, // 90 / 100 * 100
        revenue: 50000,
      });
    });

    it('should handle zero bookingCount without dividing by zero', async () => {
      bookingRepositoryMock.countBookingsByDateRange.mockResolvedValue(0);
      bookingRepositoryMock.countBookingsByStatusAndDateRange.mockResolvedValue(
        0,
      );
      userRepositoryMock.countUsersByRoleAndDateRange.mockResolvedValue(0);
      financeRepositoryMock.findPaidInvoicesForAnalytics.mockResolvedValue([]);

      const result = await service.getMonthlyStats('2028-12');

      expect(result.successRate).toBe(0);
      expect(result.revenue).toBe(0);
    });
  });
});
