import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CLIENT SETUP
// ============================================
const databaseUrl = process.env.DATABASE_URL!;
const url = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  allowPublicKeyRetrieval: true,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🤖 Starting standalone medicine import...');

  const crawlMedicinesPath = path.join(
    __dirname,
    '../../Tools/crawl/medicines.json',
  );

  if (!fs.existsSync(crawlMedicinesPath)) {
    console.error(
      `❌ Crawled medicines file not found at ${crawlMedicinesPath}`,
    );
    process.exit(1);
  }

  interface CrawledMedicine {
    code: string;
    brandName?: string | null;
    genericName?: string | null;
    concentration?: string | null;
    dosageForm?: string | null;
    defaultUnit?: string | null;
    defaultPrice?: number | null;
    notes?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    sourceSite?: string | null;
    registrationNumber?: string | null;
    ingredients?: string | null;
    sideEffects?: string | null;
    warnings?: string | null;
    manufacturerBrand?: string | null;
    country?: string | null;
    imagePath?: string | null;
    usage?: string | null;
    uses?: string | null;
  }

  try {
    const rawData = fs.readFileSync(crawlMedicinesPath, 'utf8');
    const crawledMedicines = JSON.parse(rawData) as CrawledMedicine[];

    if (!Array.isArray(crawledMedicines) || crawledMedicines.length === 0) {
      console.warn('⚠️ No medicines found in JSON array.');
      return;
    }

    console.log(
      `🔍 Loaded ${crawledMedicines.length} medicines from crawl tool.`,
    );
    console.log('⏳ Syncing medicines to database via upsert...');

    // Sync records one by one to support updating existing ones
    let count = 0;
    for (const med of crawledMedicines) {
      if (!med.code) {
        console.warn('⚠️ Skipping item without code:', med.brandName);
        continue;
      }

      const defaultPrice = med.defaultPrice ? Number(med.defaultPrice) : 0.0;

      const data = {
        genericName: med.genericName || 'Chưa rõ',
        brandName: med.brandName || null,
        concentration: med.concentration || null,
        dosageForm: med.dosageForm || null,
        defaultUnit: med.defaultUnit || 'viên',
        defaultPrice: defaultPrice,
        notes: med.notes || null,
        registrationNumber: med.registrationNumber || null,
        ingredients: med.ingredients || null,
        sideEffects: med.sideEffects || null,
        warnings: med.warnings || null,
        manufacturerBrand: med.manufacturerBrand || null,
        country: med.country || null,
        imagePath: med.imagePath || null,
        imageUrl: med.imageUrl || null,
        sourceUrl: med.sourceUrl || null,
        sourceSite: med.sourceSite || null,
        usage: med.usage || null,
        uses: med.uses || null,
      };

      await prisma.medicine.upsert({
        where: { code: med.code },
        update: data,
        create: {
          code: med.code,
          ...data,
          stockQuantity: 100,
          isActive: true,
        },
      });

      count++;
      if (count % 100 === 0) {
        console.log(
          `  ⚡ Processed ${count}/${crawledMedicines.length} medicines...`,
        );
      }
    }

    console.log(
      `✅ Successfully imported/updated ${count} medicines in the database.`,
    );
  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
