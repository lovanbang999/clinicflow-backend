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
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { MessageCodes } from 'src/common/constants/message-codes.const';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly usersService: UsersService,
  ) {}

  @Post('icon')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage(MessageCodes.SERVICE_CREATED, 'Icon uploaded successfully')
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

    return { iconUrl: url, publicId };
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage(MessageCodes.USER_UPDATED, 'Avatar uploaded successfully')
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
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url, publicId } = await this.uploadService.uploadAvatar(file);

    await this.usersService.updateAvatar(userId, url);

    return { url, publicId };
  }

  @Post('lab-result')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(
    UserRole.ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
    UserRole.DOCTOR,
  )
  @ResponseMessage(
    MessageCodes.LAB_RESULT_UPLOADED,
    'Lab result file uploaded successfully',
  )
  @ApiOperation({
    summary: 'Upload a lab result file (PDF, Image)',
    description: 'Upload a lab result document. Max size: 10MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Lab result file (PDF, PNG, JPG)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
  })
  async uploadLabResult(@UploadedFile() file: Express.Multer.File) {
    const { url, publicId } = await this.uploadService.uploadLabResult(file);

    return { url, publicId };
  }
}
