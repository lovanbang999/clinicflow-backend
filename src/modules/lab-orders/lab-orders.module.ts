import { Module, forwardRef } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersGateway } from './lab-orders.gateway';
import { DatabaseModule } from '../database/database.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => BillingModule)],
  controllers: [LabOrdersController],
  providers: [LabOrdersService, LabOrdersGateway],
  exports: [LabOrdersService, LabOrdersGateway],
})
export class LabOrdersModule {}
