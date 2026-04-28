import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { I_USER_REPOSITORY } from './interfaces/user.repository.interface';
import { PrismaUserRepository } from './repositories/prisma-user.repository';
import { I_TOKEN_REPOSITORY } from './interfaces/token.repository.interface';
import { PrismaTokenRepository } from './repositories/prisma-token.repository';
import { I_VERIFICATION_REPOSITORY } from './interfaces/verification.repository.interface';
import { PrismaVerificationRepository } from './repositories/prisma-verification.repository';
import { I_CATALOG_REPOSITORY } from './interfaces/catalog.repository.interface';
import { PrismaCatalogRepository } from './repositories/prisma-catalog.repository';
import { I_BOOKING_REPOSITORY } from './interfaces/booking.repository.interface';
import { PrismaBookingRepository } from './repositories/prisma-booking.repository';
import { I_PROFILE_REPOSITORY } from './interfaces/profile.repository.interface';
import { PrismaProfileRepository } from './repositories/prisma-profile.repository';
import { I_CLINICAL_REPOSITORY } from './interfaces/clinical.repository.interface';
import { PrismaClinicalRepository } from './repositories/prisma-clinical.repository';
import { I_FINANCE_REPOSITORY } from './interfaces/finance.repository.interface';
import { PrismaFinanceRepository } from './repositories/prisma-finance.repository';
import { I_SYSTEM_REPOSITORY } from './interfaces/system.repository.interface';
import { PrismaSystemRepository } from './repositories/prisma-system.repository';
import { I_AI_REPOSITORY } from './interfaces/ai.repository.interface';
import { PrismaAiRepository } from './repositories/prisma-ai.repository';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: I_USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: I_TOKEN_REPOSITORY,
      useClass: PrismaTokenRepository,
    },
    {
      provide: I_VERIFICATION_REPOSITORY,
      useClass: PrismaVerificationRepository,
    },
    {
      provide: I_CATALOG_REPOSITORY,
      useClass: PrismaCatalogRepository,
    },
    {
      provide: I_BOOKING_REPOSITORY,
      useClass: PrismaBookingRepository,
    },
    {
      provide: I_PROFILE_REPOSITORY,
      useClass: PrismaProfileRepository,
    },
    {
      provide: I_CLINICAL_REPOSITORY,
      useClass: PrismaClinicalRepository,
    },
    {
      provide: I_FINANCE_REPOSITORY,
      useClass: PrismaFinanceRepository,
    },
    {
      provide: I_SYSTEM_REPOSITORY,
      useClass: PrismaSystemRepository,
    },
    {
      provide: I_AI_REPOSITORY,
      useClass: PrismaAiRepository,
    },
  ],
  exports: [
    I_USER_REPOSITORY,
    I_TOKEN_REPOSITORY,
    I_VERIFICATION_REPOSITORY,
    I_CATALOG_REPOSITORY,
    I_BOOKING_REPOSITORY,
    I_PROFILE_REPOSITORY,
    I_CLINICAL_REPOSITORY,
    I_FINANCE_REPOSITORY,
    I_SYSTEM_REPOSITORY,
    I_AI_REPOSITORY,
  ],
})
export class DatabaseModule {}
