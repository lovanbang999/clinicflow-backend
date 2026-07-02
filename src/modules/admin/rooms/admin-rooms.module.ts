import { Module } from '@nestjs/common';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';

@Module({
  imports: [],
  controllers: [AdminRoomsController],
  providers: [AdminRoomsService],
  exports: [AdminRoomsService],
})
export class AdminRoomsModule {}
