import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({ url: process.env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    console.log('👋 Database disconnected');
  }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === 'string' && key[0] !== '_' && key !== 'constructor',
    ) as string[];

    await Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as { deleteMany: () => Promise<unknown> }).deleteMany();
        }
        return Promise.resolve();
      }),
    );
  }
}
