import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { aiProvider } from './ai.provider';
import { SpecialtyTool } from './tools/specialty.tool';
import { ScheduleTool } from './tools/schedule.tool';
import { BookingTool } from './tools/booking.tool';
import { CloudflareAdapter } from './cloudflare.adapter';
import { AiSessionService } from './ai-session.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [PrismaModule, BookingsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiSessionService,
    aiProvider,
    SpecialtyTool,
    ScheduleTool,
    BookingTool,
    CloudflareAdapter,
  ],
})
export class AiModule {}
