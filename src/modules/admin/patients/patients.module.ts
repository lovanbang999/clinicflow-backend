import { Module } from '@nestjs/common';
import { AdminPatientsController } from './patients.controller';
import { AdminPatientsService } from './patients.service';

@Module({
  controllers: [AdminPatientsController],
  providers: [AdminPatientsService],
  exports: [AdminPatientsService],
})
export class AdminPatientsModule {}
