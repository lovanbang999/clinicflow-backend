import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionistAnalyticsController } from './receptionist-analytics.controller';
import { ReceptionistAnalyticsService } from './receptionist-analytics.service';

describe('ReceptionistAnalyticsController', () => {
  let controller: ReceptionistAnalyticsController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getOverview: jest.fn(),
      getRevenueTrend: jest.fn(),
      getOperationalStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceptionistAnalyticsController],
      providers: [
        {
          provide: ReceptionistAnalyticsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ReceptionistAnalyticsController>(
      ReceptionistAnalyticsController,
    );
  });

  it('getOverview should delegate to service', async () => {
    serviceMock.getOverview.mockResolvedValue({ totalRevenue: 100 });
    const result = await controller.getOverview({});
    expect(result).toEqual({ totalRevenue: 100 });
    expect(serviceMock.getOverview).toHaveBeenCalledWith({});
  });

  it('getRevenueTrend should delegate to service', async () => {
    serviceMock.getRevenueTrend.mockResolvedValue({ chart: [] });
    const result = await controller.getRevenueTrend({});
    expect(result).toEqual({ chart: [] });
    expect(serviceMock.getRevenueTrend).toHaveBeenCalledWith({});
  });

  it('getOperationalStats should delegate to service', async () => {
    serviceMock.getOperationalStats.mockResolvedValue({ bookingSources: [] });
    const result = await controller.getOperationalStats({});
    expect(result).toEqual({ bookingSources: [] });
    expect(serviceMock.getOperationalStats).toHaveBeenCalledWith({});
  });
});
