import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VisitServiceOrdersController } from './visit-service-orders.controller';
import { VisitServiceOrdersService } from './visit-service-orders.service';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [VisitServiceOrdersController],
  providers: [VisitServiceOrdersService],
  exports: [VisitServiceOrdersService],
})
export class VisitServiceOrdersModule {}
