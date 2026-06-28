import { Module } from '@nestjs/common';
import { AdminPatientsModule } from './patients/admin-patients.module';
import { AdminAnalyticsModule } from './analytics/admin-analytics.module';
import { AdminSettingsModule } from './settings/admin-settings.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminDoctorsModule } from './doctors/admin-doctors.module';
import { AdminServicesModule } from './services/admin-services.module';
import { AdminSchedulesModule } from './schedules/admin-schedules.module';
import { AdminUsersModule } from './users/admin-users.module';
import { AdminRoomsModule } from './rooms/admin-rooms.module';
import { AdminMedicinesModule } from './medicines/admin-medicines.module';

@Module({
  imports: [
    AdminDashboardModule,
    AdminUsersModule,
    AdminDoctorsModule,
    AdminServicesModule,
    AdminSchedulesModule,
    AdminPatientsModule,
    AdminRoomsModule,
    AdminAnalyticsModule,
    AdminSettingsModule,
    AdminMedicinesModule,
  ],
  exports: [
    AdminDashboardModule,
    AdminUsersModule,
    AdminDoctorsModule,
    AdminServicesModule,
    AdminSchedulesModule,
    AdminPatientsModule,
    AdminRoomsModule,
    AdminAnalyticsModule,
    AdminSettingsModule,
    AdminMedicinesModule,
  ],
})
export class AdminModule {}
