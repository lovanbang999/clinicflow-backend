import { Prisma } from '@prisma/client';
const f: Prisma.JsonFilter = { array_contains: 'foo' };
const f2: Prisma.JsonFilter = { string_contains: 'foo' };
