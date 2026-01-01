import { Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly uploadDir = './uploads/icons';
  private readonly allowedExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.webp',
  ];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  async uploadIcon(file: Express.Multer.File | undefined): Promise<string> {
    // Validate file
    this.validateFile(file);

    // Type guard ensures file is defined after validation
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Ensure upload directory exists
    await this.ensureUploadDir();

    // Generate unique filename
    const fileExtension = extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${fileExtension}`;
    const filepath = `${this.uploadDir}/${filename}`;

    // Save file
    await fs.writeFile(filepath, file.buffer);

    // Return URL path (relative to server)
    return `/uploads/icons/${filename}`;
  }

  async deleteIcon(iconUrl: string): Promise<void> {
    if (!iconUrl) return;

    try {
      // Extract filename from URL
      const filename = iconUrl.split('/').pop();
      if (!filename) return;

      const filepath = `${this.uploadDir}/${filename}`;

      // Check if file exists
      await fs.access(filepath);

      // Delete file
      await fs.unlink(filepath);
    } catch {
      // File doesn't exist or already deleted - ignore
      console.log('Icon file not found or already deleted:', iconUrl);
    }
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

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }
}
