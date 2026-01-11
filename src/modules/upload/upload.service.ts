import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { extname } from 'path';
import { promises as fs } from 'fs';
import * as streamifier from 'streamifier';
import { v2 as CloudinaryType } from 'cloudinary';
import { CLOUDINARY } from 'src/providers/cloudinary.provider';

type UploadResult = {
  url: string; // secure URL of the uploaded image
  publicId: string; // Cloudinary public ID of the uploaded image
};

@Injectable()
export class UploadService {
  private readonly iconUploadDir = './uploads/icons';
  private readonly avatarUploadDir = './uploads/avatars';
  private readonly allowedExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.webp',
  ];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryType,
  ) {}

  async uploadIcon(
    file: Express.Multer.File | undefined,
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(file);

    // Type guard ensures file is defined after validation
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Put icons in a folder (helps management in Cloudinary dashboard)
    return this.uploadBufferToCloudinary(file, 'smart-clinic/icons');
  }

  async deleteIcon(publicId: string | null | undefined): Promise<void> {
    if (!publicId) return;

    try {
      await this.cloudinary.uploader.destroy(publicId, {
        // for images, resource_type defaults to 'image'
        invalidate: true, // invalidates CDN caches
      });
    } catch (e) {
      // ignore if already deleted / not found
      console.log('Cloudinary delete failed:', publicId, e);
    }
  }

  async uploadAvatar(
    file: Express.Multer.File | undefined,
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(file);

    // Type guard ensures file is defined after validation
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.uploadBufferToCloudinary(file, 'smart-clinic/avatars');
  }

  async deleteAvatar(publicId: string | null | undefined): Promise<void> {
    if (!publicId) return;

    try {
      await this.cloudinary.uploader.destroy(publicId, {
        // for images, resource_type defaults to 'image'
        invalidate: true, // invalidates CDN caches
      });
    } catch (e) {
      // ignore if already deleted / not found
      console.log('Cloudinary delete failed:', publicId, e);
    }
  }

  // --- HELPER METHODS ---
  private async uploadBufferToCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    const toError = (e: unknown, fallback: string) =>
      e instanceof Error ? e : new Error(typeof e === 'string' ? e : fallback);

    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(toError(error, 'Cloudinary upload failed'));
            return;
          }

          if (!result) {
            reject(new Error('Cloudinary upload failed: empty result'));
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Check file extension
    const ext = extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedExtensions.join(', ')}`,
      );
    }

    // Check MIME type
    const validMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/svg+xml',
      'image/webp',
    ];
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file MIME type');
    }
  }

  private async ensureUploadDir(uploadDir: string): Promise<void> {
    try {
      await fs.access(uploadDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(uploadDir, { recursive: true });
    }
  }
}
