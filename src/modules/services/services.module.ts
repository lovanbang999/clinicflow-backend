import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { UploadModule } from '../upload/upload.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [UploadModule, DatabaseModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
