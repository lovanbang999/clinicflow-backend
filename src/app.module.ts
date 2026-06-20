import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
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
import { LabOrdersModule } from './modules/lab-orders/lab-orders.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReceptionistAnalyticsModule } from './modules/receptionist/analytics/receptionist-analytics.module';
import { VisitServiceOrdersModule } from './modules/visit-service-orders/visit-service-orders.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 }, // max 10 req/sec per IP
      { name: 'medium', ttl: 60000, limit: 100 }, // max 100 req/min per IP
    ]),
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
    LabOrdersModule,
    BillingModule,
    ReceptionistAnalyticsModule,
    VisitServiceOrdersModule,
    CategoriesModule,
    AnalyticsModule,
    AiModule,
  ],
  providers: [
    AppService,
    // Global rate limiter
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global guard - apply JWT auth to all routes by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global interceptor for standard API responses mapping
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
