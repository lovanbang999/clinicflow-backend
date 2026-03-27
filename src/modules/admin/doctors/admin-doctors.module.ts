import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminDoctorsController } from './admin-doctors.controller';
import { AdminDoctorsService } from './admin-doctors.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminDoctorsController],
  providers: [AdminDoctorsService],
  exports: [AdminDoctorsService],
})
export class AdminDoctorsModule {}
