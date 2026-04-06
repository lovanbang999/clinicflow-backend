import { Injectable, Inject } from '@nestjs/common';
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(args: { symptoms: string }) {
    const categories = await this.catalogRepository.findManyCategory({
      where: {
        type: 'EXAMINATION',
        isActive: true,
      },
      select: {
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
          },
        },
      },
    });

    return categories;
  }
}
