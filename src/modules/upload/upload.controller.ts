import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UserRole } from '@prisma/client';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('icon')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadIcon(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponse> {
    const iconUrl = await this.uploadService.uploadIcon(file);

    return {
      success: true,
      data: { iconUrl },
      message: 'Icon uploaded successfully',
      messageCode: MessageCodes.SERVICE_CREATED,
      statusCode: 201,
      timestamp: new Date().toISOString(),
    };
  }
}
