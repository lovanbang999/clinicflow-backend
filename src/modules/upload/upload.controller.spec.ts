import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UsersService } from '../users/users.service';
import { BadRequestException } from '@nestjs/common';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadServiceMock: Record<string, jest.Mock>;
  let usersServiceMock: Record<string, jest.Mock>;

  const mockFile = {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: Buffer.from('test-data'),
    size: 9,
    stream: null as unknown as import('stream').Readable,
    destination: '',
    filename: '',
    path: '',
  } as Express.Multer.File;

  beforeEach(async () => {
    uploadServiceMock = {
      uploadIcon: jest.fn(),
      uploadAvatar: jest.fn(),
      uploadLabResult: jest.fn(),
    };
    usersServiceMock = {
      updateAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: uploadServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  describe('uploadIcon', () => {
    it('should call uploadService.uploadIcon and return url & publicId', async () => {
      const uploadResponse = {
        url: 'https://cloudinary.com/icon.png',
        publicId: 'icon-id',
      };
      uploadServiceMock.uploadIcon.mockResolvedValue(uploadResponse);

      const result = await controller.uploadIcon(mockFile);

      expect(uploadServiceMock.uploadIcon).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual({
        iconUrl: 'https://cloudinary.com/icon.png',
        publicId: 'icon-id',
      });
    });

    it('should propagate BadRequestException from service', async () => {
      uploadServiceMock.uploadIcon.mockRejectedValue(
        new BadRequestException('Invalid file format'),
      );

      await expect(controller.uploadIcon(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadAvatar', () => {
    it('should call uploadService.uploadAvatar, usersService.updateAvatar, and return url & publicId', async () => {
      const userId = 'user-123';
      const uploadResponse = {
        url: 'https://cloudinary.com/avatar.png',
        publicId: 'avatar-id',
      };
      uploadServiceMock.uploadAvatar.mockResolvedValue(uploadResponse);
      usersServiceMock.updateAvatar.mockResolvedValue({
        id: userId,
        avatar: uploadResponse.url,
      });

      const result = await controller.uploadAvatar(userId, mockFile);

      expect(uploadServiceMock.uploadAvatar).toHaveBeenCalledWith(mockFile);
      expect(usersServiceMock.updateAvatar).toHaveBeenCalledWith(
        userId,
        uploadResponse.url,
      );
      expect(result).toEqual({
        url: 'https://cloudinary.com/avatar.png',
        publicId: 'avatar-id',
      });
    });
  });

  describe('uploadLabResult', () => {
    it('should call uploadService.uploadLabResult and return url & publicId', async () => {
      const uploadResponse = {
        url: 'https://cloudinary.com/result.pdf',
        publicId: 'result-id',
      };
      uploadServiceMock.uploadLabResult.mockResolvedValue(uploadResponse);

      const result = await controller.uploadLabResult(mockFile);

      expect(uploadServiceMock.uploadLabResult).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual({
        url: 'https://cloudinary.com/result.pdf',
        publicId: 'result-id',
      });
    });
  });
});
