import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

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
