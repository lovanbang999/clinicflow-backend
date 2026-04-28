import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminRoomsController],
  providers: [AdminRoomsService],
  exports: [AdminRoomsService],
})
export class AdminRoomsModule {}
