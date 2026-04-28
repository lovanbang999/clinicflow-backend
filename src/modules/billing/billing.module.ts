import { Module, forwardRef } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LabOrdersModule } from '../lab-orders/lab-orders.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    forwardRef(() => LabOrdersModule),
    QueueModule,
  ],

  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
