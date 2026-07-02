import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminMedicinesController } from './admin-medicines.controller';
import { AdminMedicinesService } from './admin-medicines.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminMedicinesController],
  providers: [AdminMedicinesService],
  exports: [AdminMedicinesService],
})
export class AdminMedicinesModule {}
