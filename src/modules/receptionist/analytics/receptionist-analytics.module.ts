import { Module } from '@nestjs/common';
import { ReceptionistAnalyticsService } from './receptionist-analytics.service';
import { ReceptionistAnalyticsController } from './receptionist-analytics.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReceptionistAnalyticsController],
  providers: [ReceptionistAnalyticsService],
  exports: [ReceptionistAnalyticsService],
})
export class ReceptionistAnalyticsModule {}
