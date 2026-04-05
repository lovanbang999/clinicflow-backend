import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SpecialtyTool {
  constructor(private readonly prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(args: { symptoms: string }) {
    const categories = await this.prisma.category.findMany({
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
