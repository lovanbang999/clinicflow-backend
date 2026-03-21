import { Test, TestingModule } from '@nestjs/testing';
import { LabOrdersController } from './lab-orders.controller';

describe('LabOrdersController', () => {
  let controller: LabOrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabOrdersController],
    }).compile();

    controller = module.get<LabOrdersController>(LabOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
