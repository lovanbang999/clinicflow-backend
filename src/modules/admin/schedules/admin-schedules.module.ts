import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminSchedulesController } from './admin-schedules.controller';
import { AdminSchedulesService } from './admin-schedules.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSchedulesController],
  providers: [AdminSchedulesService],
  exports: [AdminSchedulesService],
})
export class AdminSchedulesModule {}
