import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  I_CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../database/interfaces/catalog.repository.interface';

@Injectable()
export class SpecialtyTool {
  constructor(
    @Inject(I_CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async execute(args: { symptoms: string }) {
    const { symptoms } = args;

    const baseSelect = {
      id: true,
      name: true,
      description: true,
      services: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          serviceCode: true,
          price: true,
          durationMinutes: true,
          tags: true,
        },
      },
    };

    // Step 1: Try to find matching categories by name or description
    let categories: Prisma.CategoryGetPayload<{
      select: {
        id: true;
        name: true;
        description: true;
        services: {
          where: { isActive: true };
          select: {
            id: true;
            name: true;
            serviceCode: true;
            price: true;
            durationMinutes: true;
            tags: true;
          };
        };
      };
    }>[] = [];

    let matchedByKeyword = false;

    if (symptoms) {
      categories = await this.catalogRepository.findManyCategory({
        where: {
          type: 'EXAMINATION',
          isActive: true,
          OR: [
            { name: { contains: symptoms } },
            { description: { contains: symptoms } },
          ],
        },
        select: baseSelect,
        take: 10,
      });
      matchedByKeyword = categories.length > 0;
    }

    // Step 2: Fallback — return ALL active examination categories for AI to choose
    if (categories.length === 0) {
      categories = await this.catalogRepository.findManyCategory({
        where: {
          type: 'EXAMINATION',
          isActive: true,
        },
        select: baseSelect,
        orderBy: { name: 'asc' },
      });
    }

    return {
      matchedByKeyword,
      symptomQuery: symptoms,
      hint: matchedByKeyword
        ? 'Kết quả khớp từ khóa triệu chứng.'
        : 'Không tìm thấy chuyên khoa khớp từ khóa. Đây là toàn bộ chuyên khoa khả dụng — hãy suy luận chuyên khoa phù hợp nhất dựa trên triệu chứng.',
      specialties: categories,
    };
  }
}
