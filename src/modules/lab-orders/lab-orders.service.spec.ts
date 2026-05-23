import { Test, TestingModule } from '@nestjs/testing';
import { LabOrdersService } from './lab-orders.service';

describe('LabOrdersService', () => {
  let service: LabOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrdersService,
        {
          provide: 'IClinicalRepository',
          useValue: {},
        },
        {
          provide: 'IBookingRepository',
          useValue: {},
        },
        {
          provide: 'IProfileRepository',
          useValue: {},
        },
        {
          provide: 'LabOrdersGateway',
          useValue: {},
        },
        {
          provide: 'BillingService',
          useValue: {},
        },
        {
          provide: 'MedicalRecordsService',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
