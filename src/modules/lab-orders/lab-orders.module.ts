import { Module } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { LabOrdersController } from './lab-orders.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LabOrdersController],
  providers: [LabOrdersService],
})
export class LabOrdersModule {}
