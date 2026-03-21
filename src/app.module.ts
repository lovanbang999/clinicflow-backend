import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ServicesModule } from './modules/services/services.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { QueueModule } from './modules/queue/queue.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    // Global modules
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    UploadModule,
    ServicesModule,
    SchedulesModule,
    BookingsModule,
    QueueModule,
    SuggestionsModule,
    NotificationsModule,
    AdminModule,
    MedicalRecordsModule,
  ],
  providers: [
    // Global guard - apply JWT auth to all routes by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
