import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsController', () => {
  let controller: AdminAnalyticsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getAnalyticsOverview: jest.fn(),
      getTopDoctors: jest.fn(),
      getTopServices: jest.fn(),
      getRevenueChart: jest.fn(),
      getBookingOverview: jest.fn(),
      getRevenueReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAnalyticsController],
      providers: [
        {
          provide: AdminAnalyticsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminAnalyticsController>(AdminAnalyticsController);
  });

  it('getAnalyticsOverview should delegate to service', async () => {
    serviceMock.getAnalyticsOverview.mockResolvedValue({ totalUsers: 10 });
    const result = await controller.getAnalyticsOverview({});
    expect(result).toEqual({ totalUsers: 10 });
    expect(serviceMock.getAnalyticsOverview).toHaveBeenCalledWith({});
  });

  it('getTopDoctors should delegate to service with default and custom limits', async () => {
    serviceMock.getTopDoctors.mockResolvedValue({ topDoctors: [] });

    // With limit
    await controller.getTopDoctors({ limit: '10' });
    expect(serviceMock.getTopDoctors).toHaveBeenLastCalledWith(10, {
      limit: '10',
    });

    // Without limit (defaults to 5)
    await controller.getTopDoctors({});
    expect(serviceMock.getTopDoctors).toHaveBeenLastCalledWith(5, {});
  });

  it('getTopServices should delegate to service with default and custom limits', async () => {
    serviceMock.getTopServices.mockResolvedValue({ topServices: [] });

    // With limit
    await controller.getTopServices({ limit: '3' });
    expect(serviceMock.getTopServices).toHaveBeenLastCalledWith(3, {
      limit: '3',
    });

    // Without limit (defaults to 5)
    await controller.getTopServices({});
    expect(serviceMock.getTopServices).toHaveBeenLastCalledWith(5, {});
  });

  it('getRevenueChart should delegate to service', async () => {
    serviceMock.getRevenueChart.mockResolvedValue({ chart: [] });
    const result = await controller.getRevenueChart({ period: 'month' });
    expect(result).toEqual({ chart: [] });
    expect(serviceMock.getRevenueChart).toHaveBeenCalledWith({
      period: 'month',
    });
  });

  it('getBookingOverview should delegate to service', async () => {
    serviceMock.getBookingOverview.mockResolvedValue({ total: 10 });
    const result = await controller.getBookingOverview({});
    expect(result).toEqual({ total: 10 });
    expect(serviceMock.getBookingOverview).toHaveBeenCalledWith({});
  });

  it('getRevenueReport should delegate to service', async () => {
    serviceMock.getRevenueReport.mockResolvedValue({ summary: {} });
    const result = await controller.getRevenueReport({});
    expect(result).toEqual({ summary: {} });
    expect(serviceMock.getRevenueReport).toHaveBeenCalledWith({});
  });
});
