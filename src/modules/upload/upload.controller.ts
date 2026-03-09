import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { UserRole } from '@prisma/client';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ResponseHelper } from 'src/common/interfaces/api-response.interface';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('icon')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload service icon (ADMIN only)',
    description: 'Upload an icon for a service. Max size: 5MB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Icon file (PNG, JPG, JPEG, SVG, WEBP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Icon uploaded successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Icon uploaded successfully',
        messageCode: 'SERVICE.CREATE.SUCCESS',
        data: {
          iconUrl:
            'https://res.cloudinary.com/<cloud>/image/upload/v123/smart-clinic/icons/xxx.png',
          publicId: 'smart-clinic/icons/xxx',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file',
  })
  async uploadIcon(@UploadedFile() file: Express.Multer.File) {
    const { url, publicId } = await this.uploadService.uploadIcon(file);

    return ResponseHelper.success(
      { iconUrl: url, publicId },
      MessageCodes.SERVICE_CREATED,
      'Icon uploaded successfully',
      201,
    );
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload user avatar',
    description:
      'Upload an avatar for the current user. Max size: 5MB. Allowed formats: PNG, JPG, JPEG, SVG, WEBP',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Avatar uploaded successfully',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Avatar uploaded successfully',
        messageCode: 'USER.AVATAR.UPLOADED',
        data: {
          url: 'https://res.cloudinary.com/<cloud>/image/upload/v123/smart-clinic/avatars/xxx.jpg',
          publicId: 'smart-clinic/avatars/xxx',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file or file too large',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    const { url, publicId } = await this.uploadService.uploadAvatar(file);

    return ResponseHelper.success(
      { url, publicId },
      MessageCodes.USER_UPDATED,
      'Avatar uploaded successfully',
      201,
    );
  }
}
