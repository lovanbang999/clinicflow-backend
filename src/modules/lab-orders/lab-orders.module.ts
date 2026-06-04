import { Module, forwardRef } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersGateway } from './lab-orders.gateway';
import { DatabaseModule } from '../database/database.module';
import { BillingModule } from '../billing/billing.module';
import { MedicalRecordsModule } from '../medical-records/medical-records.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    DatabaseModule,
    PrismaModule,
    forwardRef(() => BillingModule),
    MedicalRecordsModule,
  ],
  controllers: [LabOrdersController],
  providers: [LabOrdersService, LabOrdersGateway],
  exports: [LabOrdersService, LabOrdersGateway],
})
export class LabOrdersModule {}
