import { Test, TestingModule } from '@nestjs/testing';
import { LabOrdersService } from './lab-orders.service';

describe('LabOrdersService', () => {
  let service: LabOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LabOrdersService],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
