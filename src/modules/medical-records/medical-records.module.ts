import { Module, forwardRef } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    forwardRef(() => BillingModule),
    QueueModule,
  ],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
