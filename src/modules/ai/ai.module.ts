import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { aiProvider } from './ai.provider';
import { SpecialtyTool } from './tools/specialty.tool';
import { ScheduleTool } from './tools/schedule.tool';
import { BookingTool } from './tools/booking.tool';
import { DoctorTool } from './tools/doctor.tool';
import { MyBookingsTool } from './tools/my-bookings.tool';
import { CloudflareAdapter } from './cloudflare.adapter';
import { GroqAdapter } from './groq.adapter';
import { AiSessionService } from './ai-session.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [PrismaModule, DatabaseModule, BookingsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiSessionService,
    aiProvider,
    SpecialtyTool,
    ScheduleTool,
    BookingTool,
    DoctorTool,
    MyBookingsTool,
    CloudflareAdapter,
    GroqAdapter,
  ],
})
export class AiModule {}
