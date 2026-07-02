import { Module } from '@nestjs/common';
import { AdminSchedulesController } from './admin-schedules.controller';
import { AdminSchedulesService } from './admin-schedules.service';

@Module({
  imports: [],
  controllers: [AdminSchedulesController],
  providers: [AdminSchedulesService],
  exports: [AdminSchedulesService],
})
export class AdminSchedulesModule {}
