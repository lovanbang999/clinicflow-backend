import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    serviceMock = {
      getDashboardOverview: jest.fn(),
      getMonthlyStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
  });

  it('getDashboardOverview should delegate to service', async () => {
    serviceMock.getDashboardOverview.mockResolvedValue({ totalUsers: 15 });
    const result = await controller.getDashboardOverview({});
    expect(result).toEqual({ totalUsers: 15 });
    expect(serviceMock.getDashboardOverview).toHaveBeenCalledWith({});
  });

  it('getMonthlyStats should delegate to service with month string', async () => {
    serviceMock.getMonthlyStats.mockResolvedValue({ bookingCount: 5 });
    const result = await controller.getMonthlyStats({ month: '2028-12' });
    expect(result).toEqual({ bookingCount: 5 });
    expect(serviceMock.getMonthlyStats).toHaveBeenCalledWith('2028-12');
  });
});
