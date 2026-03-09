import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';

import { AdminDoctorsService } from './doctors/admin-doctors.service';
import { AdminDoctorsController } from './doctors/admin-doctors.controller';

import { AdminServicesService } from './services/admin-services.service';
import { AdminServicesController } from './services/admin-services.controller';

import { AdminUsersController } from './users/admin-users.controller';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminDoctorsController,
    AdminServicesController,
  ],
  providers: [AdminDashboardService, AdminDoctorsService, AdminServicesService],
  exports: [AdminDashboardService, AdminDoctorsService, AdminServicesService],
})
export class AdminModule {}
