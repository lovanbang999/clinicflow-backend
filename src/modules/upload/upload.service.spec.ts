import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { CLOUDINARY } from '../../providers/cloudinary.provider';
import { BadRequestException } from '@nestjs/common';
import { Writable } from 'stream';

interface MockCloudinary {
  uploader: {
    destroy: jest.Mock;
    upload_stream: jest.Mock;
  };
}

describe('UploadService', () => {
  let service: UploadService;
  let cloudinaryMock: MockCloudinary;
  let shouldFailStreamUpload = false;

  beforeEach(async () => {
    shouldFailStreamUpload = false;

    cloudinaryMock = {
      uploader: {
        destroy: jest.fn(),
        upload_stream: jest
          .fn()
          .mockImplementation(
            (
              options: { folder?: string },
              callback: (
                err: Error | null,
                res: { secure_url: string; public_id: string } | null,
              ) => void,
            ) => {
              const stream = new Writable({
                write(chunk, encoding, next) {
                  next();
                },
              });
              // Call callback asynchronously when stream finishes piping
              stream.on('finish', () => {
                if (shouldFailStreamUpload) {
                  callback(new Error('Cloudinary upload error'), null);
                } else {
                  callback(null, {
                    secure_url: `https://res.cloudinary.com/demo/image/upload/${options.folder || 'test'}/file.png`,
                    public_id: `${options.folder || 'test'}/file_public_id`,
                  });
                }
              });
              return stream;
            },
          ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: CLOUDINARY, useValue: cloudinaryMock },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  const createMockFile = (
    originalname: string,
    mimetype: string,
    sizeBytes: number,
  ): Express.Multer.File => {
    const file = {
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype,
      size: sizeBytes,
      destination: '',
      filename: '',
      path: '',
      buffer: Buffer.from('mock file content'),
    };
    return file as unknown as Express.Multer.File;
  };

  describe('validations', () => {
    it('should throw BadRequestException if no file is provided', async () => {
      await expect(service.uploadIcon(undefined)).rejects.toThrow(
        new BadRequestException('No file provided'),
      );
    });

    it('should sanitize file name characters', async () => {
      const file = createMockFile('my file#$123.png', 'image/png', 100);
      await service.uploadIcon(file);
      // ' ' (space), '#', and '$' should be replaced by '_'
      expect(file.originalname).toBe('my_file__123.png');
    });

    it('should throw BadRequestException if file exceeds 5MB limit', async () => {
      const largeFile = createMockFile(
        'test.png',
        'image/png',
        5 * 1024 * 1024 + 1,
      );
      await expect(service.uploadIcon(largeFile)).rejects.toThrow(
        new BadRequestException('File size exceeds 5MB limit'),
      );
    });

    it('should throw BadRequestException if extension is not allowed', async () => {
      const badExtFile = createMockFile('test.exe', 'image/png', 100);
      await expect(service.uploadIcon(badExtFile)).rejects.toThrow(
        new BadRequestException(
          'Invalid file type. Allowed types: .png, .jpg, .jpeg, .svg, .webp, .pdf, .docx',
        ),
      );
    });

    it('should throw BadRequestException if MIME type is not allowed', async () => {
      const badMimeFile = createMockFile('test.png', 'application/json', 100);
      await expect(service.uploadIcon(badMimeFile)).rejects.toThrow(
        new BadRequestException('Invalid file MIME type'),
      );
    });
  });

  describe('uploadIcon', () => {
    it('should upload icon to smart-clinic/icons folder successfully', async () => {
      const file = createMockFile('icon.png', 'image/png', 1024);
      const result = await service.uploadIcon(file);

      expect(cloudinaryMock.uploader.upload_stream).toHaveBeenCalledWith(
        {
          folder: 'smart-clinic/icons',
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        expect.any(Function),
      );
      expect(result.url).toContain('smart-clinic/icons');
      expect(result.publicId).toBe('smart-clinic/icons/file_public_id');
    });

    it('should throw error if Cloudinary upload fails', async () => {
      shouldFailStreamUpload = true;
      const file = createMockFile('icon.png', 'image/png', 1024);
      await expect(service.uploadIcon(file)).rejects.toThrow(
        'Cloudinary upload error',
      );
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar to smart-clinic/avatars folder', async () => {
      const file = createMockFile('avatar.jpg', 'image/jpeg', 1024);
      const result = await service.uploadAvatar(file);

      expect(cloudinaryMock.uploader.upload_stream).toHaveBeenCalledWith(
        {
          folder: 'smart-clinic/avatars',
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        expect.any(Function),
      );
      expect(result.url).toContain('smart-clinic/avatars');
    });
  });

  describe('uploadLabResult', () => {
    it('should upload pdf lab result with resource_type auto', async () => {
      const file = createMockFile('result.pdf', 'application/pdf', 1024);
      const result = await service.uploadLabResult(file);

      expect(cloudinaryMock.uploader.upload_stream).toHaveBeenCalledWith(
        {
          folder: 'smart-clinic/lab-results',
          resource_type: 'auto',
          unique_filename: true,
          overwrite: false,
        },
        expect.any(Function),
      );
      expect(result.url).toContain('smart-clinic/lab-results');
    });

    it('should upload image lab result with resource_type image', async () => {
      const file = createMockFile('result.png', 'image/png', 1024);
      const result = await service.uploadLabResult(file);

      expect(cloudinaryMock.uploader.upload_stream).toHaveBeenCalledWith(
        {
          folder: 'smart-clinic/lab-results',
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        expect.any(Function),
      );
      expect(result.url).toContain('smart-clinic/lab-results');
    });
  });

  describe('delete methods', () => {
    it('should not call destroy if publicId is falsy', async () => {
      await service.deleteIcon(null);
      await service.deleteAvatar('');
      expect(cloudinaryMock.uploader.destroy).not.toHaveBeenCalled();
    });

    it('should delete icon successfully', async () => {
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'ok' });
      await service.deleteIcon('my-icon-id');
      expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(
        'my-icon-id',
        {
          invalidate: true,
        },
      );
    });

    it('should delete avatar successfully', async () => {
      cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'ok' });
      await service.deleteAvatar('my-avatar-id');
      expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(
        'my-avatar-id',
        {
          invalidate: true,
        },
      );
    });

    it('should ignore destroy errors and log warn', async () => {
      cloudinaryMock.uploader.destroy.mockRejectedValue(
        new Error('Destruction failed'),
      );
      // Should not throw exception
      await expect(service.deleteIcon('some-id')).resolves.not.toThrow();
    });
  });
});
