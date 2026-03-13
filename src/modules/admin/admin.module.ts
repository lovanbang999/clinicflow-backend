import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDoctorsService } from './doctors/admin-doctors.service';
import { AdminDoctorsController } from './doctors/admin-doctors.controller';
import { AdminServicesService } from './services/admin-services.service';
import { AdminServicesController } from './services/admin-services.controller';
import { AdminSchedulesService } from './schedules/admin-schedules.service';
import { AdminSchedulesController } from './schedules/admin-schedules.controller';
import { AdminUsersController } from './users/admin-users.controller';

import { AdminPatientsModule } from './patients/patients.module';

@Module({
  imports: [PrismaModule, UsersModule, AdminPatientsModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminDoctorsController,
    AdminServicesController,
    AdminSchedulesController,
  ],
  providers: [
    AdminDashboardService,
    AdminDoctorsService,
    AdminServicesService,
    AdminSchedulesService,
  ],
  exports: [
    AdminDashboardService,
    AdminDoctorsService,
    AdminServicesService,
    AdminSchedulesService,
  ],
})
export class AdminModule {}
