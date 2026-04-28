import { Injectable } from '@nestjs/common';
import {
  ISystemRepository,
  I_SYSTEM_REPOSITORY,
} from '../../database/interfaces/system.repository.interface';
import { Inject } from '@nestjs/common';
import { ResponseHelper } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class AdminSettingsService {
  constructor(
    @Inject(I_SYSTEM_REPOSITORY)
    private readonly systemRepository: ISystemRepository,
  ) {}

  /**
   * Get settings by category (namespace)
   */
  async getSettingsByCategory(
    category: string,
  ): Promise<Record<string, unknown>> {
    const configs = await this.systemRepository.findManySystemConfig({
      where: { category: category.toUpperCase() },
    });

    const settings: Record<string, unknown> = {};
    configs.forEach((c) => {
      // Convert value based on dataType
      let val: unknown = c.value;
      if (c.dataType === 'number') val = Number(c.value);
      if (c.dataType === 'boolean') val = c.value === 'true';
      if (c.dataType === 'json') {
        try {
          val = JSON.parse(c.value) as unknown;
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
    data: Record<string, unknown>,
    userId: string,
  ) {
    const operations: Promise<unknown>[] = [];

    for (const [shortKey, value] of Object.entries(data)) {
      if (value === undefined) continue;

      const fullKey = `${category.toLowerCase()}.${shortKey}`;
      const stringValue =
        typeof value === 'object'
          ? JSON.stringify(value)
          : String(value as string | number | boolean);
      const dataType = typeof value;

      operations.push(
        this.systemRepository.upsertSystemConfig({
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
    const results: Record<string, unknown> = {};

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
