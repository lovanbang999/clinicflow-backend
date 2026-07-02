import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { AdminDoctorsController } from './admin-doctors.controller';
import { AdminDoctorsService } from './admin-doctors.service';

@Module({
  imports: [UsersModule],
  controllers: [AdminDoctorsController],
  providers: [AdminDoctorsService],
  exports: [AdminDoctorsService],
})
export class AdminDoctorsModule {}
