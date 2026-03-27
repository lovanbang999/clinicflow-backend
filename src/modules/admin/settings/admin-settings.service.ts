import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get settings by category (namespace)
   */
  async getSettingsByCategory(category: string): Promise<Record<string, any>> {
    const configs = await this.prisma.systemConfig.findMany({
      where: { category: category.toUpperCase() },
    });

    const settings: Record<string, any> = {};
    configs.forEach((c) => {
      // Convert value based on dataType
      let val: any = c.value;
      if (c.dataType === 'number') val = Number(c.value);
      if (c.dataType === 'boolean') val = c.value === 'true';
      if (c.dataType === 'json') {
        try {
          val = JSON.parse(c.value);
        } catch {
          val = {};
        }
      }

      // Map key "clinic.name" to "name" if we want to strip the prefix
      const key = c.key.includes('.') ? c.key.split('.').pop()! : c.key;
      settings[key] = val;
    });

    return settings;
  }

  /**
   * Batch update settings for a specific category
   */
  async updateSettings(
    category: string,
    data: Record<string, any>,
    userId: string,
  ) {
    const operations: Promise<any>[] = [];

    for (const [shortKey, value] of Object.entries(data)) {
      if (value === undefined) continue;

      const fullKey = `${category.toLowerCase()}.${shortKey}`;
      const stringValue =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      const dataType = typeof value;

      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: fullKey },
          update: {
            value: stringValue,
            updatedBy: userId,
          },
          create: {
            key: fullKey,
            value: stringValue,
            category: category.toUpperCase(),
            dataType: dataType === 'object' ? 'json' : dataType,
            updatedBy: userId,
          },
        }),
      );
    }

    if (operations.length > 0) {
      await Promise.all(operations);
    }

    return ResponseHelper.success(
      data,
      `ADMIN.SETTINGS.${category.toUpperCase()}_UPDATED`,
      `Settings for ${category} updated successfully`,
      200,
    );
  }

  /**
   * Get all settings grouped by category
   */
  async getAllSettings() {
    const categories = ['CLINIC', 'BOOKING', 'NOTIFICATION', 'SECURITY'];
    const results: Record<string, any> = {};

    for (const cat of categories) {
      results[cat.toLowerCase()] = await this.getSettingsByCategory(cat);
    }

    return ResponseHelper.success(
      results,
      'ADMIN.SETTINGS.ALL_RETRIEVED',
      'All system settings retrieved successfully',
      200,
    );
  }
}
